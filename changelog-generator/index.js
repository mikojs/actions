const core = require('@actions/core');
const github = require('@actions/github');
const { format } = require('date-fns');

const { repo } = github.context;
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
const releaseInfo = {};

// TODO: support monorepo
const initializeRelease = configStr => {
  const config = JSON.parse(configStr);

  Object.keys(config)
    .forEach(key => {
      releaseInfo[key] = {
        title: config[key],
        items: [],
      };
    });

  if (!releaseInfo.uncategorized)
    releaseInfo.uncategorized = {
      title: ':question: Uncategorized',
      items: [],
    };
};

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

const loadPullRequests = pullRequestNumbers =>
  pullRequestNumbers.reduce(
    async (resultP, pullRequestNumber) => {
      await resultP;
      core.debug(`loading ${pullRequestNumber}`);

      const { data: { html_url: url, title, body, labels, user } } = await octokit.rest.pulls.get({
        ...repo,
        pull_number: pullRequestNumber,
      });
      const item = {
        number: pullRequestNumber,
        url,
        title,
        // TODO: body could overwrite title
        body,
        user,
      };

      labels.forEach(({ name }) => {
        const { items } = (releaseInfo[name] || releaseInfo.uncategorized);

        if (items.some(({ number }) => number === item.number))
          return;

        items.unshift(item);
      });
      core.debug(`${pullRequestNumber} is added`);
    },
    Promise.resolve(),
  );

const renderRelease = nextVersion => {
  const release = [
    // FIXME: date should be same as tag
    `## ${nextVersion} (${format(new Date(), 'yyyy-mm-dd')})`,
    ...Object.keys(releaseInfo)
      .filter(key => releaseInfo[key].items.length !== 0)
      .map(key => [
        '',
        `#### ${releaseInfo[key].title}`,
        ...releaseInfo[key].items.map(
          ({ number, url, title, user }) => [
            '-',
            `[#${number}](${url})`,
            title.replace(/[ ]+$/, ''),
            `([@${user.login}](${user.html_url}))`,
          ].join(' '),
        ),
      ].join('\n')),
  ].join('\n');

  Object.keys(releaseInfo)
    .forEach(key => {
      releaseInfo[key].items = [];
    });
  core.debug(`new release: ${nextVersion}`);

  return release;
};

(async () => {
  try {
    initializeRelease(core.getInput('config'));

    const releases = await core.getMultilineInput('tags')
      .reduce(async (resultP, tag, index, tags) => {
        const result = await resultP;

        if (index === 0)
          return result;

        const from = await getFrom(tags[index - 1]);

        core.debug(`generating a release from ${from} to ${tag}`);
        await loadPullRequests(
          await getPullRequestNumbers(`${from}...${tag}`),
        );

        return [
          ...result,
          '',
          renderRelease(
            tag === 'HEAD'
              ? core.getInput('next version')
              : tag,
          ),
        ];
      }, Promise.resolve([]));

    console.log(releases.reverse().join('\n'));
  } catch (e) {
    core.setFailed(e.message);
  }
})();
