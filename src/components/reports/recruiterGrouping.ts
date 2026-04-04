export interface RecruiterGroupedRepBase {
  userId: string;
  name: string;
  recruiterName?: string | null;
  fp: number;
  isWorking?: boolean;
}

export interface RecruiterTreeNode<T extends RecruiterGroupedRepBase> {
  recruiter: T;
  childGroups: RecruiterTreeNode<T>[];
  leafReps: T[];
  memberCount: number;
  totalFP: number;
  workingCount: number;
}

interface RecruiterCandidate<T extends RecruiterGroupedRepBase> {
  node: RecruiterTreeNode<T> | null;
  allMembers: T[];
}

const MIN_RECRUITER_GROUP_SIZE = 2;

const normalizeRecruiterName = (name: string) =>
  name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().toLowerCase();

const dedupeByUserId = <T extends { userId: string }>(items: T[]) => {
  const seen = new Set<string>();
  const deduped: T[] = [];

  items.forEach((item) => {
    if (seen.has(item.userId)) return;
    seen.add(item.userId);
    deduped.push(item);
  });

  return deduped;
};

const sortNodesByFp = <T extends RecruiterGroupedRepBase>(nodes: RecruiterTreeNode<T>[]) =>
  [...nodes].sort((a, b) => b.totalFP - a.totalFP);

export const buildRecruiterTree = <T extends RecruiterGroupedRepBase>(reps: T[]) => {
  const directRecruits = new Map<string, T[]>();

  reps.forEach((rep) => {
    const recruiterKey = rep.recruiterName ? normalizeRecruiterName(rep.recruiterName) : null;
    if (!recruiterKey) return;

    if (!directRecruits.has(recruiterKey)) {
      directRecruits.set(recruiterKey, []);
    }

    directRecruits.get(recruiterKey)!.push(rep);
  });

  const visibleRecruiters = reps.filter(
    (rep) => (directRecruits.get(normalizeRecruiterName(rep.name)) || []).length > 0,
  );

  const visibleRecruiterKeys = new Set(visibleRecruiters.map((rep) => normalizeRecruiterName(rep.name)));
  const memo = new Map<string, RecruiterCandidate<T>>();

  const buildCandidate = (recruiter: T, visiting: Set<string>): RecruiterCandidate<T> => {
    const recruiterKey = normalizeRecruiterName(recruiter.name);

    if (visiting.has(recruiterKey)) {
      return { node: null, allMembers: [recruiter] };
    }

    const cached = memo.get(recruiterKey);
    if (cached) return cached;

    const nextVisiting = new Set(visiting);
    nextVisiting.add(recruiterKey);

    const directs = directRecruits.get(recruiterKey) || [];
    const childGroups: RecruiterTreeNode<T>[] = [];
    const leafReps: T[] = [];
    const allMembers: T[] = [recruiter];

    directs.forEach((directRep) => {
      const directKey = normalizeRecruiterName(directRep.name);

      if ((directRecruits.get(directKey) || []).length > 0) {
        const childCandidate = buildCandidate(directRep, nextVisiting);
        allMembers.push(...childCandidate.allMembers);

        if (childCandidate.node) {
          childGroups.push(childCandidate.node);
        } else {
          leafReps.push(...childCandidate.allMembers);
        }

        return;
      }

      allMembers.push(directRep);
      leafReps.push(directRep);
    });

    const dedupedMembers = dedupeByUserId(allMembers);
    const dedupedLeafReps = dedupeByUserId(leafReps);
    const descendantCount = dedupedMembers.length - 1;

    const candidate: RecruiterCandidate<T> = {
      node:
        descendantCount >= MIN_RECRUITER_GROUP_SIZE
          ? {
              recruiter,
              childGroups: sortNodesByFp(childGroups),
              leafReps: dedupedLeafReps,
              memberCount: dedupedMembers.length,
              totalFP: dedupedMembers.reduce((sum, rep) => sum + rep.fp, 0),
              workingCount: dedupedMembers.filter((rep) => rep.isWorking).length,
            }
          : null,
      allMembers: dedupedMembers,
    };

    memo.set(recruiterKey, candidate);
    return candidate;
  };

  const rootRecruiters = visibleRecruiters.filter((rep) => {
    const parentKey = rep.recruiterName ? normalizeRecruiterName(rep.recruiterName) : null;
    return !parentKey || !visibleRecruiterKeys.has(parentKey);
  });

  const groups = (rootRecruiters.length > 0 ? rootRecruiters : visibleRecruiters)
    .map((recruiter) => buildCandidate(recruiter, new Set()).node)
    .filter((node): node is RecruiterTreeNode<T> => Boolean(node));

  const assignedIds = new Set<string>();
  const markAssigned = (node: RecruiterTreeNode<T>) => {
    assignedIds.add(node.recruiter.userId);
    node.leafReps.forEach((rep) => assignedIds.add(rep.userId));
    node.childGroups.forEach(markAssigned);
  };

  sortNodesByFp(groups).forEach(markAssigned);

  return {
    groups: sortNodesByFp(groups),
    solo: reps.filter((rep) => !assignedIds.has(rep.userId)),
  };
};