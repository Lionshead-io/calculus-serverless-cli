import AWS from 'aws-sdk';
import _ from 'lodash';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import interpolation from './interpolation';
const nrc = require('node-run-cmd');
import exec from 'executive';
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
import TerraformDefaultAliases from '../templates/terraform/aliases';
const { task, of, fromPromised, waitAll } = require('folktale/concurrency/task');
const Result = require('folktale/result');

const uploadFunctionToS3 = (FunctionName: string, Bucket: string, Metadata: Object = {}) => {
    console.log(chalk.yellow(' - Uploading funciton .zip to S3'));
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: Bucket,
            Key: `${FunctionName}.zip`,
            Body: fs.readFileSync(`${process.cwd()}/${FunctionName}.zip`),
            Metadata,
            ServerSideEncryption: 'AES256',
        };
        s3.putObject(params, function (err, data) {
            if (err)
                return reject(err);
            else
                resolve(data);
        });
    });
};

export function packageFunction(CalculusConfig: any): Promise<any> {
    console.log(chalk.yellow(' - Packaging function into .zip file'));
    let commands = [
        {command: `rm -rf ${CalculusConfig.FunctionName}.zip`},
        {command: `zip -r -j ${CalculusConfig.FunctionName}.zip dist/index.js`}
    ];

    return nrc.run(commands, {cwd: `${process.cwd()}`});
}

const pullTerraformScripts = (): Promise<any> => {
    let commands = [
        {command: `git clone https://github.com/Lionshead-Consulting/calculus-terraform-template.git terraform`}
    ];

    return nrc.run(commands, {cwd: `${process.cwd()}`});
};

async function getFunctionAliasValues(CalculusConfig: any, envs: Array<string> = ['dev', 'qa', 'preprod', 'prod']): Promise<any> {
    const lambda = new AWS.Lambda({
        apiVersion: '2015-03-31',
        region: CalculusConfig.tfvars.region
    });

    const getFunction = (FunctionName) => {
        let params = { FunctionName };

        return new Promise(function (resolve, reject) {
            lambda.getFunction(params, function(err, data) {
                if (err) reject(err);
                else     resolve(data);
            });
        });
    };

    const getFunctionAlias = (FunctionName, alias) => {
        let params = {
            FunctionName,
            Name: alias
        };

        return new Promise(function (resolve, reject) {
            lambda.getAlias(params, function(err, data) {
                if (err) reject(err);
                else     resolve(data);
            });
        });
    };

    let getFunctionT = fromPromised(getFunction);
    let getFunctionAliasT = fromPromised(getFunctionAlias);

    try {
        let functionExists = await getFunctionT(CalculusConfig.FunctionName).map(res => Result.Ok(res)).orElse(err => of(Result.Error(err))).run().promise();
        let aliases = await waitAll([
            getFunctionAliasT(CalculusConfig.FunctionName, 'dev'),
            getFunctionAliasT(CalculusConfig.FunctionName, 'qa'),
            getFunctionAliasT(CalculusConfig.FunctionName, 'preprod'),
            getFunctionAliasT(CalculusConfig.FunctionName, 'prod')
        ])
            .map(res => Result.Ok(
                res.map((currVal) => {
                    return {
                        'aws_lambda_alias': {
                            [`${currVal.Name}_alias`]: {
                                name: currVal.Name,
                                description: currVal.Description,
                                function_name: '${aws_lambda_function.calculus_generated_function.arn}',
                                function_version: (process.env.NODE_ENV === currVal.Name) ? '${aws_lambda_function.calculus_generated_function.version}' : currVal.FunctionVersion
                            }
                        }
                    };
                })
            ))
            .orElse(err => of(Result.Error(err)))
            .run()
            .promise();


        return functionExists.chain(_ => aliases).getOrElse(TerraformDefaultAliases);
    } catch (err) {
        return TerraformDefaultAliases;
    }
}

async function interpolateTerraformScripts(CalculusConfig: any): void {
    console.log(chalk.yellow(' - Configuring Terraform scripts'));
    // Interpolate Terraform template expressions within calculus.tf.json, vars.tfvars.json
    let calculusTF = fs.readFileSync(`${process.cwd()}/terraform/calculus.tf.json`, "utf8");
    let nextCalculusTF = JSON.parse(interpolation(calculusTF, {
        FunctionName: CalculusConfig.FunctionName,
        Bucket: CalculusConfig.Bucket,
        Region: CalculusConfig.tfvars.region,
        NODE_ENV: process.env.NODE_ENV || 'development'
    }));

    // Based on the stage Env variable, we will update the correct stage alias with the following value,
    let aresult = await getFunctionAliasValues(CalculusConfig);
    console.log(aresult, 'aresult');
    nextCalculusTF.resource.push(...aresult);

    console.log(JSON.stringify(nextCalculusTF), 'nextCalculusTF');

    let varsTF = fs.readFileSync(`${process.cwd()}/terraform/vars.tfvars`, "utf8");
    let lambdaCalcConfig = JSON.parse(fs.readFileSync(`${process.cwd()}/lambda-calculus.config.json`, 'utf8'));

    let tfvars = Object.keys(lambdaCalcConfig.tfvars).filter((currVal) => {
        return _.indexOf(['dev', 'qa', 'preprod', 'prod'], currVal) < 0;
    }).reduce((acc, currVal) => {
        acc[currVal] = lambdaCalcConfig.tfvars[currVal];

        return acc;
    }, {});
    tfvars = _.merge({ NODE_ENV: process.env.NODE_ENV || 'dev' }, tfvars, lambdaCalcConfig.tfvars[process.env.NODE_ENV] || {});
    console.log(JSON.stringify(tfvars), 'tfvars');
    for (let prop in tfvars) {
        if(prop === 'environment') continue;

        if(typeof tfvars[prop] === 'number') {
            varsTF += `${prop} = ${tfvars[prop]}${os.EOL}`;
        } else if(typeof tfvars[prop] === 'string') {
            varsTF += `${prop} = "${tfvars[prop]}"${os.EOL}`;
        }
    }
    fs.writeFileSync(`./terraform/vars.tfvars`, interpolation(varsTF, {}));

    let lambdaIdx = nextCalculusTF.resource.reduce((acc, currVal, currIdx) => {
        if(acc > -1) return acc;

        return (Object.keys(currVal)[0] === 'aws_lambda_function') ? currIdx : -1;
    }, -1);
    nextCalculusTF['resource'][lambdaIdx]['aws_lambda_function']['calculus_generated_function'].environment.variables = _.merge({}, nextCalculusTF['resource'][lambdaIdx]['aws_lambda_function']['calculus_generated_function'].environment.variables, (lambdaCalcConfig.tfvars[process.env.NODE_ENV] && lambdaCalcConfig.tfvars[process.env.NODE_ENV].environment) ? lambdaCalcConfig.tfvars[process.env.NODE_ENV].environment.variables : {})
    fs.writeFileSync(`${process.cwd()}/terraform/calculus.tf.json`, JSON.stringify(nextCalculusTF));
};

const runTerraformScripts = (): Promise<any> => {
    console.log(chalk.yellow(' - Running Terraform scripts'));
    let lambdaCalcConfig = JSON.parse(fs.readFileSync(`${process.cwd()}/lambda-calculus.config.json`, 'utf8'));

    let commands = [
        {command: `terraform init`},
        {command: `terraform plan -var-file=vars.tfvars -out=calculus-function-plan`},
        {command: `terraform apply calculus-function-plan`},
        {command: `terraform output -json version > generated-outputs.json`}
    ];

    return nrc.run(commands, {cwd: `${process.cwd()}/terraform`});
};

export async function deploy(): Promise<any> {
    const CalculusConfig = JSON.parse(fs.readFileSync(`${process.cwd()}/lambda-calculus.config.json`, 'utf-8'));

    try {
        // Create zip package of Lambda function
        await packageFunction(CalculusConfig);

        // Clone CalculusJS Terraform repo
        await pullTerraformScripts();

        // Interpolate Terraform script with function specific metadata
        await interpolateTerraformScripts(CalculusConfig);

        // Run Terraform Script to provision AWS Lambda Function
        await runTerraformScripts();

        return Promise.resolve();
    } catch (err) {
        console.log(err, 'catcherr');
    }
}
