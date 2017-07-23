// @flow
import AWS from 'aws-sdk';
import fs from 'fs';
import os from 'os';
import interpolation from './interpolation';
const nrc = require('node-run-cmd');
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const CalculusConfig = JSON.parse(fs.readFileSync(`${process.cwd()}/lambda-calculus.config.json`, 'utf-8'));

const uploadFunctionToS3 = (FunctionName: string, Bucket: string, Metadata: Object = {}) => {
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

export function packageFunction(): Promise<any> {
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

const interpolateTerraformScripts = (): void => {
    // Interpolate Terraform template expressions within calculus.tf.json, vars.tfvars.json
    let calculusTF = fs.readFileSync(`./terraform/calculus.tf.json`, "utf8");
    let nextCalculusTF = JSON.parse(interpolation(calculusTF, {
        FunctionName: CalculusConfig.FunctionName,
        Bucket: CalculusConfig.Bucket,
        NODE_ENV: process.env.NODE_ENV || 'development'
    }));

    // If Lambda function that is to be provisioned is going to exist in an environment(s)
    // (ex. dev, qa, test, prod, etc.) append here to Terraform json
    if(CalculusConfig.Environments.length) {
        CalculusConfig.Environments.split(',').forEach((currVal) => {
            nextCalculusTF.resource.push({
                "aws_lambda_alias": {
                    [`${currVal}_alias`]: {
                        "name": `${currVal}`,
                        "description": `${currVal}`,
                        "function_name": "${aws_lambda_function.calculus_generated_function.arn}",
                        "function_version": "$LATEST"
                    }
                }
            });
        });
    }
    fs.writeFileSync(`./terraform/calculus.tf.json`, JSON.stringify(nextCalculusTF));

    let varsTF = fs.readFileSync(`./terraform/vars.tfvars`, "utf8");
    let lambdaCalcConfig = JSON.parse(fs.readFileSync('./lambda-calculus.config.json', 'utf8'));

    for (let prop in lambdaCalcConfig.tfvars) {
        if(typeof lambdaCalcConfig.tfvars[prop] === 'number') {
            varsTF += `${prop} = ${lambdaCalcConfig.tfvars[prop]}${os.EOL}`;
        } else if(typeof lambdaCalcConfig.tfvars[prop] === 'string') {
            varsTF += `${prop} = "${lambdaCalcConfig.tfvars[prop]}"${os.EOL}`;
        }
    }
    fs.writeFileSync(`./terraform/vars.tfvars`, interpolation(varsTF, {}));
};

const runTerraformScripts = (): Promise<any> => {
    let commands = [
        {command: `terraform plan -var-file=vars.tfvars -out=calculus-function-plan`},
        {command: `terraform apply calculus-function-plan`},
        {command: `terraform output -json > generated-outputs.json`}
    ];

    return nrc.run(commands, {cwd: `${process.cwd()}/terraform`});
};

export async function deploy(): Promise<any> {
    // Create zip package of Lambda function
    await packageFunction();

    // Upload newly zipped Lambda function to S3 bucket
    await uploadFunctionToS3(CalculusConfig.FunctionName, CalculusConfig.Bucket);

    // Clone CalculusJS Terraform repo
    await pullTerraformScripts();

    // Interpolate Terraform script with function specific metadata
    interpolateTerraformScripts();

    // Run Terraform Script to provision AWS Lambda Function
    await runTerraformScripts();

    return await uploadFunctionToS3(CalculusConfig.FunctionName, CalculusConfig.Bucket);
}