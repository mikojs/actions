const core = require('@actions/core');
const github = require('@actions/github');
const { format } = require('date-fns');

const { repo } = github.context;
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
const releaseInfo = {
  uncategorized: {
    title: ':question: Uncategorized',
    items: [],
  },
};

const getFrom = async from => {
  if (from !== 'latest tag')
    return from;

  const { data: [{ name } = {}] } = await octokit.rest.repos.listTags(repo);

  if (!name)
    throw new Error('Here should have at least one tag');

  return name;
};

const initializeRelease = configStr => {
  const config = JSON.parse(configStr);

  Object.keys(config)
    .forEach(key => {
      releaseInfo[key] = {
        title: config[key],
        items: [],
      };
    });
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

const loadPullRequests = pullRequestNumbers =>
  Promise.all(pullRequestNumbers.map(
    async pullRequestNumber => {
      const { data: { title, body, labels, user } } = await octokit.rest.pulls.get({
        ...repo,
        pull_number: pullRequestNumber,
      });
      const item = {
        number: pullRequestNumber,
        title,
        body,
        user,
      };

      labels.forEach(({ name }) => {
        const { items } = (releaseInfo[name] || releaseInfo.uncategorized);

        if (items.some(({ number }) => number === item.number))
          return;

        items.push(item);
      });
    },
  ));

const renderRelease = nextVersion => [
  `## ${nextVersion} - (${format(new Date(), 'yyyy-mm-dd')})`,
].join('\n');

(async () => {
  try {
    const from = await getFrom(core.getInput('from'));
    const to = core.getInput('to');

    initializeRelease(core.getInput('config'));
    await loadPullRequests(
      await getPullRequestNumbers(`${from}...${to}`),
    );

    core.setOutput(
      'changelog',
      renderRelease(core.getInput('next version'), releaseInfo),
    );
  } catch (e) {
    core.setFailed(e.message);
  }
})();
