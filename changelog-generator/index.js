const core = require('@actions/core');
const { format } = require('date-fns');

const { repo, octokit, getFrom } = require('./utils');

const releaseInfo = {};
const workspacesInfo = {};

// TODO: support monorepo
const initializeRelease = () => {
  const { workspaces, labels } = JSON.parse(
    core.getInput('config'),
  );

  Object.keys(labels)
    .forEach(key => {
      releaseInfo[key] = {
        title: labels[key],
        items: [],
      };
    });
  Object.keys(workspaces)
    .forEach(key => {
      workspacesInfo[workspaces[key]] = key;
    });

  if (!releaseInfo.uncategorized)
    releaseInfo.uncategorized = {
      title: ':question: Uncategorized',
      items: [],
    };
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

      const {
        data: { html_url: url, title, body, labels, user },
      } = await octokit.rest.pulls.get({
        ...repo,
        pull_number: pullRequestNumber,
      });
      const {
        data,
      } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
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
        workspaces: data.reduce(
          (result, { filename }) => {
            const key = Object.keys(workspacesInfo)
              .find(worksapcesPath => filename.includes(worksapcesPath));

            return !key || result.includes(workspacesInfo[key])
              ? result
              : [...result, workspacesInfo[key]];
          },
          [],
        ),
      };

      if (item.workspaces.length === 0)
        item.workspaces.push('notFound');

      core.debug(item);
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

const getTagDate = async tag => {
  const {
    repository: {
      ref: { target },
    },
  } = await octokit.graphql(`
    query getTagDate($owner: String!, $repo: String!, $qualifiedName: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $qualifiedName) {
          id
          target {
            typename: __typename
            ... on Tag {
              id
              tagger {
                date
              }
            }
            ... on Commit {
              id
              committer {
                date
              }
            }
          }
        }
      }
    }
  `, {
    ...repo,
    qualifiedName: `refs/tags/${tag}`,
  });

  return new Date(
    target.typename === 'Tag'
      ? target.tagger.date
      : target.committer.date,
  );
};

const renderRelease = async tag => {
  const nextVersion = tag === 'HEAD'
    ? core.getInput('next version')
    : tag;
  const date = tag === 'HEAD'
    ? new Date()
    : await getTagDate(tag);
  const useWorkspaces = Object.keys(workspacesInfo).length !== 0;
  const release = [
    `## ${nextVersion} (${format(date, 'yyyy-MM-dd')})`,
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
  core.info(release);

  return release;
};

(async () => {
  try {
    initializeRelease();

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
          await renderRelease(tag),
        ];
      }, Promise.resolve([]));

    core.setOutput('relesae', releases.reverse().join('\n'));
  } catch (e) {
    core.setFailed(e.message);
  }
})();
