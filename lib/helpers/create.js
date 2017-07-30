// @flow
import AWS from 'aws-sdk';
const nrc = require('node-run-cmd');
const fs = require('fs');
import exec from 'executive';
import interpolation from './interpolation';
const CalculusConfig = require('../../lambda-calculus.config.json');
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const AWSLambda = new AWS.Lambda({
    apiVersion: '2015-03-31',
    region: 'us-east-1'
});

export async function createDirectory(fnName: string, AutomationServer: string): Promise<any> {
    // Create Directory for new function and scaffold out appropriate files.
    let commands = [
        `cd ${process.cwd()}`,
        `mkdir ${fnName}`,
        `git clone https://github.com/Lionshead-Consulting/calculus-nodejs-template.git ${fnName}`
    ];

    await exec.quiet(commands);

    if(AutomationServer === 'gocd') {
        commands = [
            `cd ${process.cwd()}/${fnName}`,
            `git clone https://github.com/Lionshead-Consulting/calculus-gocd-template.git ${process.cwd()}/${fnName}/temp`,
            `mv ${process.cwd()}/${fnName}/temp/pipeline.gocd.yaml ${process.cwd()}/${fnName}`,
            `rm -rf ${process.cwd()}/${fnName}/temp`,
        ];

        return await exec.quiet(commands);
    }

    return Promise.resolve();
}

export function interpolateFiles(fnName: string, Environments: Array<string> = [], AutomationServer: string): Promise<any> {
    // Interpolate template expressions within package.json, index.js, index.spec.js
    let packageJSON = fs.readFileSync(`${process.cwd()}/${fnName}/package.json`, "utf8");
    fs.writeFileSync(`${process.cwd()}/${fnName}/package.json`, interpolation(packageJSON, {FunctionName: fnName}));

    let shrinkwrapJSON = fs.readFileSync(`${process.cwd()}/${fnName}/npm-shrinkwrap.json`, "utf8");
    fs.writeFileSync(`${process.cwd()}/${fnName}/npm-shrinkwrap.json`, interpolation(shrinkwrapJSON, {FunctionName: fnName}));

    let lambdaConfigJSON = fs.readFileSync(`${process.cwd()}/${fnName}/lambda-calculus.config.json`, "utf8");
    fs.writeFileSync(`${process.cwd()}/${fnName}/lambda-calculus.config.json`, interpolation(lambdaConfigJSON, {
        FunctionName: fnName,
        BucketName: CalculusConfig.Bucket,
        Environments
    }));

    let indexJS = fs.readFileSync(`${process.cwd()}/${fnName}/index.js`, "utf8");
    fs.writeFileSync(`./${fnName}/index.js`, interpolation(indexJS, {FunctionName: fnName}));

    let indexSpecJS = fs.readFileSync(`${process.cwd()}/${fnName}/index.spec.js`, "utf8");
    fs.writeFileSync(`${process.cwd()}/${fnName}/index.spec.js`, interpolation(indexSpecJS, {FunctionName: fnName}));

    if(AutomationServer === 'gocd') {
        let gocdPipelineYaml = fs.readFileSync(`${process.cwd()}/${fnName}/pipeline.gocd.yaml`, "utf8");
        fs.writeFileSync(`${process.cwd()}/${fnName}/pipeline.gocd.yaml`, interpolation(gocdPipelineYaml, {
            FunctionName: fnName,
            BucketName: CalculusConfig.Bucket,
            Environments
        }));
    }

    return Promise.resolve();
}

export function createFunction(FunctionName: string): Promise<any> {
    // Create Lambda Function
    let params = {
        Code: {
            ZipFile: fs.readFileSync(`${process.cwd()}/${FunctionName}/${FunctionName}.zip`)
        },
        FunctionName: FunctionName,
        Handler: 'index.handler',
        Role: 'arn:aws:iam::348102451022:role/lambda_bae_execution',
        Runtime: 'nodejs6.10',
        Description: '',
        Environment: {
            Variables: {
                env: 'test',
            }
        },
        MemorySize: 128,
        Publish: true,
        Timeout: 300
    };

    return AWSLambda.createFunction(params).promise().then((resp) => {
        return {
            arn: resp.FunctionArn,
            version: resp.Version
        }
    }).catch((err) => err);
}

export function uploadFunction(FunctionName: string, file: any, Metadata: Object = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: CalculusConfig.Bucket,
            Key: `${FunctionName}.zip`,
            Body: file,
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
}