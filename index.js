const { Toolkit } = require("actions-toolkit");
// g1 is the keyword | g2 is issue number without #
const ISSUE_KW = /(?:^|(?<= |\t|,|\.|;|"|'|`))(close|closes|closed|fixed|fix|fixes|resolve|resolves|resolved)\s+#(\d+)/gim

Toolkit.run(async (tools) => {
  const bodyList = [];

  const { data: issue } = await tools.github.issues.get({
    ...tools.context.issue,
  });

  if (issue.body) {
    bodyList.push(issue.body)
  };
  
  const { data: comments } = await tools.github.issues.listComments({
    ...tools.context.issue,
  });

  for (let comment of comments) {
    bodyList.push(comment.body);
  }

  var issueIds = [];
  for (let body of bodyList) {
    var matches = [...body.matchAll(ISSUE_KW)];
    for (let item of matches) {
      if (item.length >= 3 && item[2].length > 0) {
        issueIds.push(item[2]);
      }
    }
  }

  if (issueIds.length <= 0) {
    tools.exit.neutral(
      "Unable to find any linked issues to label"
    );
    return;
  }

  for (let iid of issueIds) {
    tools.github.issues.addLabels({
      owner: tools.context.owner,
      repo: tools.context.repo,
      issue_number: iid,
      labels: [tools.inputs.label]      
    });
  }

  tools.exit.success("There are no incomplete task list items");
});
