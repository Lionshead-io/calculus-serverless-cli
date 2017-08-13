// @flow
import AWS from 'aws-sdk';
const nrc = require('node-run-cmd');
const fs = require('fs');
import exec from 'executive';
import interpolation from './interpolation';
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
            `https://github.com/Lionshead-io/calculusjs-gocd-template.git ${process.cwd()}/${fnName}/temp`,
            `mv ${process.cwd()}/${fnName}/temp/pipeline.gocd.yaml ${process.cwd()}/${fnName}`,
            `rm -rf ${process.cwd()}/${fnName}/temp`,
        ];

        return await exec.quiet(commands);
    }

    return Promise.resolve();
}

export async function interpolateFiles(fnName: string, Environments: Array<string> = [], AutomationServer: string): Promise<any> {
    const CalculusConfig = JSON.parse(fs.readFileSync((await exec.quiet('npm root -g')).stdout.replace(/(\r\n|\n|\r)/gm, "") + '/calculus-cli/lambda-calculus.config.json'));
    console.log(CalculusConfig, 999111);

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
