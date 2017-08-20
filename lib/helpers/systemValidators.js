const os = require('os');
const nrc = require('node-run-cmd');
const Maybe = require('folktale/maybe');
const Result = require('folktale/result');
const Validation = require('folktale/validation');
const {Success, Failure} = Validation;
const co = require('co');
const R = require('ramda');
const chalk = require('chalk');
const fs = require('fs');

const validationP = R.curry(async function(Success, next, prevVal) {
    return prevVal.concat(await next());
})(Success);

export async function gitEnabled() {
    let commands = [
        {command: `git --version`}
    ];
    let result = await nrc.run(commands, {cwd: `${process.cwd()}`});

    return (result[0] === 0) ? Success('') : Failure(['Git is not installed on this system.']);
}

export async function terraformEnabled() {
    let commands = [
        {command: `terraform --version`}
    ];
    let result = await nrc.run(commands, {cwd: `${process.cwd()}`});

    return (result[0] === 0) ? Success('') : Failure(['Terraform is not installed on this system.']);
}

export async function zipEnabled() {
    let commands = [
        {command: `zip --version`}
    ];
    let result = await nrc.run(commands, {cwd: `${process.cwd()}`});

    return (result[0] === 0) ? Success('') : Failure(['Zip utility is not installed on this system.']);
}

export async function supportedOS() {
    return (os.type() === 'Darwin' || os.type() === 'Linux') ? Success('') : Failure([`${os.type()} is not supported by CalculusJS CLI`]);
}

export async function systemPreCheck() {
    return await R.pipeP(supportedOS, gitEnabled, validationP(terraformEnabled), validationP(zipEnabled))();
}

export async function displayFailedSystemPreCheck(errors) {
    console.log(chalk.yellow(fs.readFileSync((await exec.quiet('npm root -g')).stdout.replace(/(\r\n|\n|\r)/gm, "") + '/calculus-cli/calculusjs-fig.txt')));
    console.error(chalk.bold.yellow('Warning! You cannot use CalculusJS because you are missing the following dependencies:'))
    errors.forEach((currVal, idx) => {
        console.error(chalk.red(`${(idx + 1)}. ${currVal}`));
    });
}