const core = require('@actions/core');
const { format } = require('date-fns');

const { getTagDate } = require('./getInfo');
const releaseInfo = require('./releaseInfo');

const renderLabel = ({ title, items }) =>
  items.length === 0
    ? []
    : [
        '',
        `#### ${title}`,
        items.map(
          ({ number, url, title, user }) => [
            '-',
            `[#${number}](${url})`,
            title.replace(/[ ]+$/, ''),
            `([@${user.login}](${user.html_url}))`,
          ].join(' '),
        ),
      ].flat();

module.exports = async tag => {
  const nextVersion = tag === 'HEAD'
    ? core.getInput('next version')
    : tag;
  const date = tag === 'HEAD'
    ? new Date()
    : await getTagDate(tag);
  const release = [
    `## ${nextVersion} (${format(date, 'yyyy-MM-dd')})`,
    Object.values(releaseInfo.labels)
      .map(renderLabel)
      .flat(),
  ].flat()
    .join('\n');

  releaseInfo.reset();
  core.info(release);

  return release;
};
