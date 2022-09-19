const github = require('@actions/github');

exports.repo = github.context.repo;
exports.octokit = github.getOctokit(process.env.GITHUB_TOKEN);
