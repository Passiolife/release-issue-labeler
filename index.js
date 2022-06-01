const { Toolkit } = require("actions-toolkit");
// g1 is the keyword | g2 is issue number without #
const ISSUE_KW = /(?:^|(?<= |\t|,|\.|;|"|'|`))(close|closes|closed|fixed|fix|fixes|resolve|resolves|resolved)[\s:_-]*#(\d+)/gim

Toolkit.run(async (tools) => {
  const bodyList = [];
  var owner = tools.context.repo.owner;
  var repo = tools.context.repo.repo;

  var checkedPrs = [];

  // lists pull requests associated with the incoming commit
  const respAssociatedPulls = await tools.github.repos.listPullRequestsAssociatedWithCommit({
    owner: owner,
    repo: repo,
    commit_sha: tools.context.sha
  });

  var associatedPulls = [];
  if (respAssociatedPulls.status == 200) {
    associatedPulls = respAssociatedPulls.data;
  }

  // loop associated pulls
  for (let pr of associatedPulls) {
    tools.log.info(`found linked pull #${pr.number}`)

    // keeping track of what prs we have looked at since we check more later
    checkedPrs.push(pr.number);

    // add the body message to our list to scan
    if (pr.body) {
      bodyList.push(pr.body);      
    };
    
    // list the comments on the PR
    const respComments = await tools.github.pulls.listReviewComments({
      owner: owner,
      repo: repo,
      pull_number: pr.number
    });    
    var comments = [];
    if (respComments.status == 200) {
      comments = respComments.data;
    }
    // and add those to scan too
    for (let comment of comments) {
      bodyList.push(comment.body);
    }    

  }
  
  // lets add the commit messages from the context
  for (let cm of tools.context.payload.commits) {
    bodyList.push(cm.message)

    // also for each commit, list associated PRs. This is because if merging main to release, each commit has its own PR probably
    var respCommitAssociatedPulls = await tools.github.repos.listPullRequestsAssociatedWithCommit({
      owner: owner,
      repo: repo,
      commit_sha: cm.sha
    })
    var commitAssociatedPulls = [];
    if (respCommitAssociatedPulls.status == 200) {
      commitAssociatedPulls = respCommitAssociatedPulls.data;
    }

    // again, loop those PRS
    for (let pr of commitAssociatedPulls) {

      // if we already looked at this pr, ignore it
      if (checkedPrs.includes(pr.number)) {
        continue;
      }
      // log this one as checked
      checkedPrs.push(pr.number);

      // add its body message to scanning
      if (pr.body) {
        bodyList.push(pr.body);
      };
      
      // again, list all comments on this PR
      var respCommitPrComments = await tools.github.pulls.listReviewComments({
        owner: owner,
        repo: repo,
        pull_number: pr.number
      });
      var commitPrComments = [];
      if (respCommitPrComments.status == 200) {
        commitPrComments = respCommitPrComments.data;
      }
  
      // and add them to scanning
      for (let comment of commitPrComments) {
        bodyList.push(comment.body);
      }    
    }
  }

  // scan!
  var issueIds = [];
  for (let body of bodyList) {
    var matches = [...body.matchAll(ISSUE_KW)];
    for (let item of matches) {
      if (item.length >= 3 && item[2].length > 0) {
        issueIds.push(item[2]);
      }
    }
  }

  // unique issue ids
  const unique = [...new Set(issueIds)];
  tools.log.info(`found linked issues: ${JSON.stringify(unique)}`)

  // done if we found none
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

    // add the label - note this can re-open a PR
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
