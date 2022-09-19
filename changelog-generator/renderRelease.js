const core = require('@actions/core');
const { format } = require('date-fns');

const { getTagDate } = require('./getInfo');
const releaseInfo = require('./releaseInfo');

module.exports = async tag => {
  const nextVersion = tag === 'HEAD'
    ? core.getInput('next version')
    : tag;
  const date = tag === 'HEAD'
    ? new Date()
    : await getTagDate(tag);
  const release = [
    `## ${nextVersion} (${format(date, 'yyyy-MM-dd')})`,
    ...Object.keys(releaseInfo.labels)
      .filter(key => releaseInfo.labels[key].items.length !== 0)
      .map(key => [
        '',
        `#### ${releaseInfo.labels[key].title}`,
        ...releaseInfo.labels[key].items.map(
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
