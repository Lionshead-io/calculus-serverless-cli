#!/usr/bin/env node

import _ from 'lodash';
import fs from 'fs';
import R from 'ramda';
import axios from 'axios';
import chalk from 'chalk';
import cli from 'commander';
const Maybe = require('folktale/maybe');
const Result = require('folktale/result');
const {task} = require('folktale/concurrency/task');
const Spinner = require('cli-spinner').Spinner;
let spinner = new Spinner(chalk.yellow('Generating Lambda Function & installing NPM packages... %s'));
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
    switch (Command) {
        case 'deploy': {
            let spinner = new Spinner(chalk.yellow('Deploying Lambda Function... %s'));
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
                spinner.start();

                await createDirectory(FunctionName);
                await interpolateFiles(FunctionName, Environments);
                // await uploadFunction(fnName, fs.readFileSync(`${process.cwd()}/${fnName}/${fnName}.zip`));
                // let result = createFunction(fnName);

                spinner.stop();
                console.log(chalk.bold.green('\n', `Lambda Function "${FunctionName}" has been created.`));
            } catch (err) {
                spinner.stop();
                console.error('\n', chalk.bold.red(err));
            }
        }
    }
})(FunctionName, Command, Environments);
