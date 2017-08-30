#!/usr/bin/env node

import fs from 'fs';
import chalk from 'chalk';
import cli from 'commander';
import exec from 'executive'
import { systemPreCheck, displayFailedSystemPreCheck } from './lib/helpers/systemValidators';
const Maybe = require('folktale/maybe');
const Result = require('folktale/result');
const Spinner = require('cli-spinner').Spinner;
let spinner = new Spinner(chalk.yellow('Creating Lambda Function... %s'));
spinner.setSpinnerString('|/-\\');

import {parseEnvironments, parseAutomationServer} from './lib/helpers/cliParsers';
import {createDirectory, interpolateFiles, createFunction, uploadFunction} from './lib/helpers/create';
import {deploy} from './lib/helpers/deploy';

let FunctionName: string = '';
let Command: string = '';
let Environments: Array<string> = [];
let AutomationServer: string = '';

cli.version('1.0.21')
    .arguments('<cmd> [fnName]')
    .option('-a, --automationserver <automationServer>', 'Automation server: "jenkins" or "gocd"')
    .action((cmd, fnName) => {
        Command = cmd;
        FunctionName = fnName;
        Environments = parseEnvironments('').getOrElse(['dev', 'qa', 'preprod', 'prod']);
        AutomationServer = parseAutomationServer(cli.automationserver).getOrElse('gocd');
    })
    .parse(process.argv);

(async function init(FunctionName, Command, Environments, AutomationServer) {
    (await systemPreCheck()).matchWith({
        Success: (async function({ value }) {
            switch (Command) {
                case 'deploy': {
                    console.log(chalk.yellow(fs.readFileSync((await exec.quiet('npm root -g')).stdout.replace(/(\r\n|\n|\r)/gm, "") + '/calculus-cli/calculusjs-fig.txt')));
                    try {
                        await deploy();

                        console.log(chalk.bold.green('\n', `Lambda Function Deployed`));
                    } catch(err) {
                        console.error('\n', chalk.bold.red(err));
                        process.exit(1);
                    }
                    break;
                }
                case 'create': {
                    try {
                        console.log(chalk.yellow(fs.readFileSync((await exec.quiet('npm root -g')).stdout.replace(/(\r\n|\n|\r)/gm, "") + '/calculus-cli/calculusjs-fig.txt')));
                        console.log(chalk.yellow('Creating Lambda Function...'));

                        await createDirectory(FunctionName, AutomationServer);
                        console.log('\n', chalk.yellow(' - Cloning base Lambda function'));

                        await interpolateFiles(FunctionName, Environments, AutomationServer);
                        console.log(chalk.yellow('  - Configuring your new Lambda function\n'));

                        console.log(chalk.bold.green(`Lambda Function "${FunctionName}" has been created.\n`));
                        console.log(chalk.bold.cyan(`Next steps:`));
                        console.log(chalk.cyan(`   1) cd ./${FunctionName}`));
                        console.log(chalk.cyan(`   2) npm install`));
                        console.log(chalk.cyan(`   3) npm run build`));
                        console.log(chalk.cyan(`   4) Your Lambda is ready to be deployed :)`));
                    } catch (err) {
                        spinner.stop();
                        console.error('\n', chalk.bold.red(err));
                    }
                    break;
                }
                default: {
                    console.log('Please enter a correct command');
                    process.exit(1);
                }
            }
        }),
        Failure: (async function({ value }) {
            await displayFailedSystemPreCheck(value);
            process.exit(1);
        })
    });
})(FunctionName, Command, Environments, AutomationServer);
