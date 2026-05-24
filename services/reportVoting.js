import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../firebase";

export function getCurrentVoterId() {
  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error("auth-required");
  }

  return userId;
}

export async function voteOnReport(reportId, nextVote) {
  const userId = getCurrentVoterId();

  const reportRef = doc(db, "reports", reportId);
  const voteRef = doc(db, "reports", reportId, "votes", userId);

  await runTransaction(db, async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    const voteSnapshot = await transaction.get(voteRef);

    if (!reportSnapshot.exists()) {
      throw new Error("report-not-found");
    }

    const report = reportSnapshot.data();
    const previousVote = voteSnapshot.exists()
      ? voteSnapshot.data().vote
      : null;

    let credibleCount = report.credibleCount ?? 0;
    let notCredibleCount = report.notCredibleCount ?? 0;

    if (previousVote === "credible") {
      credibleCount = Math.max(0, credibleCount - 1);
    }

    if (previousVote === "notCredible") {
      notCredibleCount = Math.max(0, notCredibleCount - 1);
    }

    if (previousVote === nextVote) {
      transaction.update(reportRef, {
        credibleCount,
        notCredibleCount,
      });
      transaction.delete(voteRef);
      return;
    }

    if (nextVote === "credible") {
      credibleCount += 1;
    }

    if (nextVote === "notCredible") {
      notCredibleCount += 1;
    }

    transaction.update(reportRef, {
      credibleCount,
      notCredibleCount,
    });

    transaction.set(voteRef, {
      vote: nextVote,
      userId,
      updatedAt: serverTimestamp(),
    });
  });
}
