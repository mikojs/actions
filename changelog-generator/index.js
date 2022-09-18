const core = require('@actions/core');
const github = require('@actions/github');

const { repo } = github.context;
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

const getFrom = async from => {
  if (from !== 'latest tag')
    return from;

  const { data: [{ name } = {}] } = await octokit.rest.repos.listTags(repo);

  if (!name)
    throw new Error('Here should have at least one tag');

  return name;
};

const getPullRequestNumbers = async basehead => {
  const { data: { commits } } = await octokit.request(
    'GET /repos/{owner}/{repo}/compare/{basehead}', {
      ...repo,
      basehead,
    },
  );

  return commits.reduce((result, { commit: { message }}) => {
    const pullRequestNumber = message
      .replace(/\*.+/g, '')
      .match(/\(#\d+\)/)
      ?.[0]
      .replace(/\(#(.+)\)/, (_, p1) => p1);

    return !pullRequestNumber
      ? result
      : [...result, pullRequestNumber];
  }, []);
};

const getPullRequests = pullRequestNumbers =>
  Promise.all(pullRequestNumbers.map(
    async pullRequestNumber => {
      const { data: { title, body } } = await octokit.rest.pulls.get({
        ...repo,
        pull_number: pullRequestNumber,
      });

      return { title, body };
    },
  ));

(async () => {
  try {
    // TODO: should remove default value
    const from = await getFrom(core.getInput('from') || 'latest tag');
    const to = core.getInput('to') || 'HEAD';

    const pullRequestNumbers = await getPullRequestNumbers(`${from}...${to}`);
    const pullRequests = await getPullRequests(pullRequestNumbers);

    console.log(pullRequests)
  } catch (e) {
    core.setFailed(e.message);
  }
})();
