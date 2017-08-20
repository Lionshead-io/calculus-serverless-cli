import AWS from 'aws-sdk';
import _ from 'lodash';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import interpolation from './interpolation';
const nrc = require('node-run-cmd');
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

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

const interpolateTerraformScripts = (CalculusConfig: any): void => {
    console.log(chalk.yellow(' - Configuring Terraform scripts'));
    // Interpolate Terraform template expressions within calculus.tf.json, vars.tfvars.json
    let calculusTF = fs.readFileSync(`${process.cwd()}/terraform/calculus.tf.json`, "utf8");
    let nextCalculusTF = JSON.parse(interpolation(calculusTF, {
        FunctionName: CalculusConfig.FunctionName,
        Bucket: CalculusConfig.Bucket,
        NODE_ENV: process.env.NODE_ENV || 'development'
    }));

    // If Lambda function that is to be provisioned is going to exist in an environment(s)
    // (ex. dev, qa, test, prod, etc.) append here to Terraform json
    nextCalculusTF.resource.push({
        "aws_lambda_alias": {
            [`${process.env.NODE_ENV}_alias`]: {
                "name": `${process.env.NODE_ENV}`,
                "description": `${process.env.NODE_ENV}`,
                "function_name": "${aws_lambda_function.calculus_generated_function.arn}",
                "function_version": "${aws_lambda_function.calculus_generated_function.version}"
            }
        }
    });

    let varsTF = fs.readFileSync(`${process.cwd()}/terraform/vars.tfvars`, "utf8");
    let lambdaCalcConfig = JSON.parse(fs.readFileSync(`${process.cwd()}/lambda-calculus.config.json`, 'utf8'));

    let tfvars = Object.keys(lambdaCalcConfig.tfvars).filter((currVal) => {
        return _.indexOf(['dev', 'qa', 'preprod', 'prod'], currVal) < 0;
    }).reduce((acc, currVal) => {
        acc[currVal] = lambdaCalcConfig.tfvars[currVal];

        return acc;
    }, {});
    tfvars = _.merge({}, tfvars, lambdaCalcConfig.tfvars[process.env.NODE_ENV] || {});
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

        // Upload newly zipped Lambda function to S3 bucket
        await uploadFunctionToS3(CalculusConfig.FunctionName, CalculusConfig.Bucket);

        // Clone CalculusJS Terraform repo
        await pullTerraformScripts();

        // Interpolate Terraform script with function specific metadata
        interpolateTerraformScripts(CalculusConfig);

        // Run Terraform Script to provision AWS Lambda Function
        await runTerraformScripts();

        return Promise.resolve();
    } catch (err) {
        console.log(err, 'catcherr');
    }
}