const { Toolkit } = require("actions-toolkit");
// g1 is the keyword | g2 is issue number without #
const ISSUE_KW = /(?:^|(?<= |\t|,|\.|;|"|'|`))(close|closes|closed|fixed|fix|fixes|resolve|resolves|resolved)[\s:_-]*#(\d+)/gim

Toolkit.run(async (tools) => {
  const bodyList = [];
  var owner = tools.context.repo.owner;
  var repo = tools.context.repo.repo;

  const { data: associatedPulls } = await tools.github.repos.listPullRequestsAssociatedWithCommit({
    owner: owner,
    repo: repo,
    commit_sha: tools.context.sha
  })

  for (let pr of associatedPulls) {
    tools.log.info(`found linked pull #${pr.number}`)
    
    if (pr.body) {
      bodyList.push(pr.body);
      tools.log.info(`found pull body: ${pr.body}`)
    };
    
    const { data: comments } = await tools.github.pulls.listReviewComments({
      owner: owner,
      repo: repo,
      pull_number: pr.number
    });

    tools.log.info(`found review ${comments.length} comments to scan on the pull`)
  
    for (let comment of comments) {
      bodyList.push(comment.body);
    }    

  }
  
  // lets add the commit messages from the context
  for (let cm of tools.context.payload.commits) {
    bodyList.push(cm.message)
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
  tools.log.info(`found linked issues: ${JSON.stringify(unique)}`)

  if (unique.length <= 0) {
    tools.exit.neutral(
      "Unable to find any linked issues to label"
    );
    return;
  }

  var numUpdated = 0;
  for (let iid of unique) {
    // need to check on the issue first... adding a label seems to re-open it so we will want to close after if we do so
    let oIssue = await tools.github.issues.get({
      owner: owner,
      repo: repo,
      issue_number: iid
    });

    let a = await tools.github.issues.addLabels({
      owner: owner,
      repo: repo,
      issue_number: iid,
      labels: [tools.inputs.label]      
    });
    
    // if it was previously closed, lets make sure we re-close it
    if (oIssue && oIssue.data.state === "closed") {
      let oUpdateIssue = await tools.github.issues.update({
        owner: owner,
        repo: repo,
        issue_number: iid,
        state: "closed"
      });
      tools.log.info(`issue was closed before labeling - re-closing the ticket responded with status: ${oUpdateIssue.status}`)
    }

    numUpdated += 1;
    tools.log.info(`setting issue #${iid} label to ${tools.inputs.label} had status: ${a.status}`);
  }

  tools.exit.success(`attempted to set ${numUpdated} issue labels`);
});
