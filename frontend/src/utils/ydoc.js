import * as Y from "yjs";
const docs = new Map();

export function getYDoc(docId) {
  if (!docs.has(docId)) {
    const doc = new Y.Doc();
    doc.getXmlFragment("prosemirror");
    docs.set(docId, doc);
  }
  return docs.get(docId);
}

export function destroyYDoc(docId) {
  const doc = docs.get(docId);
  if (doc) {
    doc.destroy();
    docs.delete(docId);
  }
}
