const github = require('@actions/github');

const { repo } = github.context;
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

exports.repo = repo;
exports.octokit = octokit;

exports.getFrom = async from => {
  if (from !== 'latest tag')
    return from;

  const {
    data: [{ name } = {}],
  } = await octokit.rest.repos.listTags(repo);

  if (!name)
    throw new Error('Here should have at least one tag');

  return name;
};
