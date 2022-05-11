const { Toolkit } = require("actions-toolkit");
// g1 is the keyword | g2 is issue number without #
const ISSUE_KW = /(?:^|(?<= |\t|,|\.|;|"|'|`))(close|closes|closed|fixed|fix|fixes|resolve|resolves|resolved)\s+#(\d+)/gim
const PRID = /(?:^|(?<= |\t|,|\.|;|"|'|`))(Merge pull request)\s+#(\d+)/gim
const REPO_INFO = /(github.com\/)([a-zA-Z0-9-_]*)\/([a-zA-Z0-9-_]*)\//gim

Toolkit.run(async (tools) => {
  const bodyList = [];
  var prId = null;
  var owner = null;
  var repo = null;

  // first lets add the commit messages from the context
  for (let cm of tools.context.payload.commits) {
    bodyList.push(cm.message)

    // try and get PR id from message
    var matches = [...cm.message.matchAll(PRID)];
    for (let item of matches) {
      if (item.length >= 3 && item[2].length > 0) {
        tools.log.info(`Found pull request ID in message: ${item[0]}`)
        prId = item[2];
      }
    }
    // merge context doesnt have easily accessible info so grab the owner/repo
    if (owner === null && repo === null) {
      var matches = [...cm.url.matchAll(REPO_INFO)];
      for (let item of matches) {
        if (item.length >= 4 && item[2].length > 0 && item[3].length > 0) {
          owner = item[2];
          repo = item[3];
          tools.log.info(`Found repo info: ${owner}/${repo}`)
        }
      }      
    }
  }

  if (prId !== null && owner !== null && repo !== null) {
    const { data: issue } = await tools.github.issues.get({
      owner: owner,
      repo: repo,
      issue_number: prId
    });
  
    if (issue.body) {
      bodyList.push(issue.body)
    };
    
    const { data: comments } = await tools.github.issues.listComments({
      owner: owner,
      repo: repo,
      issue_number: prId
    });
  
    for (let comment of comments) {
      bodyList.push(comment.body);
    }
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

  // unique
  const unique = [...new Set(issueIds)];

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
