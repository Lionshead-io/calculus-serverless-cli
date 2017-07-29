# CalculusJS - AWS Lambda CLI + Serverless Micro-Framework for Nodejs

_Provision Nodejs AWS Lambda functions that contain a defined CI/CD pipeline._

## Why CalculusJS?
1. To propogate the adoption of DevSecOps amongst all Serverless applications you are developing.
2. As a NodeJS developer I want to use the same tooling I'm accustomed to when writing non-serverless applications (ex. Webpack, FlowType, Mocha, etc.).
3. I want to automate the development of CI/CD pipelines for each and every Lambda function I write.

## Prerequisites
- Git installed
- Terraform installed
- Unix based systems

## Installation

```
npm install -g calculus
```
_You will want to run above command as root user (sudo)._

## Configuration

```
calculus configure
```

## How to start using?

#### I. Generate a Nodejs Lambda function

<!-- Code snippet title -->
```
$ calculus create hello-world
$ cd ./hello-world
$ npm install
$ npm run build
```

#### II. Deploy your new Lambda function
```
$ cd ./hello-world
$ calculus deploy
```

## FAQs
coming soon...


## License

MIT, see `LICENSE.md` for more information.
