const github = require('@actions/github');

const { repo } = github.context;
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

exports.repo = repo;
exports.octokit = octokit;
