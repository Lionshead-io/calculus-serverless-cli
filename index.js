#!/usr/bin/env node

import fs from 'fs';
import chalk from 'chalk';
import cli from 'commander';
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

cli.version('0.0.1')
    .arguments('<cmd> [fnName]')
    .option('-a, --automationserver <automationServer>', 'Comma-delimited list of Lambda Aliases you want (ex. dev,qa,test,prod)')
    .option('-e, --environments <environments>', 'Comma-delimited list of Lambda Aliases you want (ex. dev,qa,test,prod)')
    .action((cmd, fnName) => {
        Command = cmd;
        FunctionName = fnName;
        Environments = parseEnvironments(cli.environments).getOrElse([]);
        AutomationServer = parseAutomationServer(cli.automationserver).getOrElse('gocd');
    })
    .parse(process.argv);

(async function init(FunctionName, Command, Environments, AutomationServer) {
    (await systemPreCheck()).matchWith({
        Success: (async function({ value }) {
            switch (Command) {
                case 'deploy': {
                    let spinner = new Spinner(chalk.yellow('Deploying Lambda Function... %s'));
                    console.log(chalk.yellow(fs.readFileSync('./calculusjs-fig.txt')));
                    spinner.start();
                    try {
                        await deploy();

                        spinner.stop();
                        console.log(chalk.bold.green('\n', `Lambda Function Deployed`));
                    } catch(err) {
                        spinner.stop();
                        console.error('\n', chalk.bold.red(err));
                    }

                    break;
                }
                default: {
                    try {
                        console.log(chalk.yellow(fs.readFileSync('./calculusjs-fig.txt')));
                        spinner.start();

                        await createDirectory(FunctionName);
                        console.log(chalk.yellow('Cloning base Lambda function...'));

                        await interpolateFiles(FunctionName, Environments);
                        console.log(chalk.yellow('Configuring your new Lambda function...'));
                        // await uploadFunction(fnName, fs.readFileSync(`${process.cwd()}/${fnName}/${fnName}.zip`));
                        // let result = createFunction(fnName);

                        spinner.stop();
                        console.log(chalk.bold.green(`Lambda Function "${FunctionName}" has been created.`));
                        console.log(chalk.bold.cyan(`Next steps:`));
                        console.log(chalk.cyan(`   1) cd ./${FunctionName}`));
                        console.log(chalk.cyan(`   2) npm install`));
                        console.log(chalk.cyan(`   3) npm run build`));
                        console.log(chalk.cyan(`   4) Your Lambda is ready to be deployed :)`));
                    } catch (err) {
                        spinner.stop();
                        console.error('\n', chalk.bold.red(err));
                    }
                }
            }
        }),
        Failure: ({ value }) => {
            displayFailedSystemPreCheck(value);
        }
    });
})(FunctionName, Command, Environments);
