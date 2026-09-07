// Two branches can each run a class of the same name, so a bare "Tamhiid 3" is
// ambiguous the moment a second campus opens. Everywhere a class is shown or
// picked, it is labelled with the branch it belongs to — "Tamhiid 3 (FR1)" —
// while the stored class name itself is never touched.

// The branch name from a class, whether the API populated it or left a bare id.
export const classBranchName = (cls) => {
  const branch = cls?.branchId;
  if (!branch || typeof branch !== 'object') return '';
  return branch.name || '';
};

// The class's own name, tolerating either of the two fields the model keeps in
// sync (name / className).
export const classNameOf = (cls) => {
  if (!cls || typeof cls !== 'object') return '';
  return cls.name || cls.className || '';
};

/**
 * Display label for a class: "Tamhiid 3 (FR1)", or just "Tamhiid 3" when the
 * class has no branch — classes recorded before branches existed still read
 * correctly rather than showing an empty "()".
 */
export const classLabel = (cls, fallback = '-') => {
  const name = classNameOf(cls);
  if (!name) return fallback;

  const branch = classBranchName(cls);
  if (!branch) return name;
  if (name.toLowerCase().endsWith(`(${branch.toLowerCase()})`)) return name;
  return `${name} (${branch})`;
};

/**
 * The same label built from a class id plus a list of classes, for the many
 * screens that hold only an id and fetch the classes separately.
 */
export const classLabelById = (classId, classes = [], fallback = '-') => {
  if (!classId) return fallback;

  const id = typeof classId === 'object' ? classId._id : classId;
  const match = classes.find((c) => String(c._id) === String(id));

  // A populated object already carries everything needed; fall back to it when
  // the class is not in the supplied list.
  return classLabel(match || (typeof classId === 'object' ? classId : null), fallback);
};

/**
 * Text a class should be matched against when searching or filtering, so typing
 * either the class name or the branch finds it.
 */
export const classSearchText = (cls) => `${classNameOf(cls)} ${classBranchName(cls)}`.trim();
