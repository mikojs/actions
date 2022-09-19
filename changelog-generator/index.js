const core = require('@actions/core');
const { format } = require('date-fns');

const { getFrom, getPullRequestNumbers, getTagDate } = require('./getInfo');
const loadInfo = require('./loadInfo');
const releaseInfo = require('./releaseInfo');

const renderRelease = async tag => {
  const nextVersion = tag === 'HEAD'
    ? core.getInput('next version')
    : tag;
  const date = tag === 'HEAD'
    ? new Date()
    : await getTagDate(tag);
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

  releaseInfo.reset();
  core.info(release);

  return release;
};

(async () => {
  try {
    const releases = await core.getMultilineInput('tags')
      .reduce(async (resultP, tag, index, tags) => {
        const result = await resultP;

        if (index === 0)
          return result;

        const from = await getFrom(tags[index - 1]);

        core.debug(`generating a release from ${from} to ${tag}`);
        await loadInfo(
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
