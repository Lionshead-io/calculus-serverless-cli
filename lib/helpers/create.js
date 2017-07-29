// @flow
import AWS from 'aws-sdk';
const nrc = require('node-run-cmd');
const fs = require('fs');
import interpolation from './interpolation';
const CalculusConfig = require('../../lambda-calculus.config.json');
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const AWSLambda = new AWS.Lambda({
    apiVersion: '2015-03-31',
    region: 'us-east-1'
});

export const createDirectory = (fnName: string): Promise<any> => {
    // Create Directory for new function and scaffold out appropriate files.
    let commands = [
        {command: `mkdir ${fnName}`},
        {command: `git clone https://github.com/Lionshead-Consulting/calculus-nodejs-template.git ${fnName}`}
    ];

    return nrc.run(commands, {cwd: `${process.cwd()}`});
};

export function interpolateFiles(fnName: string, Environments: Array<string> = []): Promise<any> {
    // Interpolate template expressions within package.json, index.js, index.spec.js
    let packageJSON = fs.readFileSync(`./${fnName}/package.json`, "utf8");
    fs.writeFileSync(`./${fnName}/package.json`, interpolation(packageJSON, {FunctionName: fnName}));

    let lambdaConfigJSON = fs.readFileSync(`./${fnName}/lambda-calculus.config.json`, "utf8");
    fs.writeFileSync(`./${fnName}/lambda-calculus.config.json`, interpolation(lambdaConfigJSON, {
        FunctionName: fnName,
        BucketName: CalculusConfig.Bucket,
        Environments
    }));

    let indexJS = fs.readFileSync(`${process.cwd()}/${fnName}/index.js`, "utf8");
    fs.writeFileSync(`./${fnName}/index.js`, interpolation(indexJS, {FunctionName: fnName}));

    let indexSpecJS = fs.readFileSync(`${process.cwd()}/${fnName}/index.spec.js`, "utf8");
    fs.writeFileSync(`./${fnName}/index.spec.js`, interpolation(indexSpecJS, {FunctionName: fnName}));

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