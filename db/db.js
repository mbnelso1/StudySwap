// src/db/db.js
import { randomUUID } from "node:crypto";

let _adapter = null;
let _doc = null;

/* =========================
Scaffold & Boot
========================= */
export function useAdapter(adapter) {
  _adapter = adapter;
}

export const uid = () => randomUUID().slice(0, 8);

export async function boot() {
  if (!_adapter) {
    throw new Error("No adapter set. Call useAdapter(...) first.");
  }
  const loaded = await _adapter.load();
  _doc = loaded && typeof loaded === "object" ? loaded : {};
  return _doc;
}

function getDoc() {
  if (!_doc) {
    throw new Error("DB not booted. Call boot() first.");
  }
  return _doc;
}

function ensureCollection(col) {
  const d = getDoc();
  if (!Array.isArray(d[col])) d[col] = [];
  return d[col];
}

async function save() {
  await _adapter.save(_doc);
  return _doc;
}

/* =========================
CRUD Helpers
========================= */

export async function insertOne(col, data) {
  const collection = ensureCollection(col);
  const now = new Date().toISOString();
  const record = {
    id: data.id ?? uid(),
    createdAt: data.createdAt ?? now,
    updatedAt: now,
    ...data
  };
  collection.push(record);
  await save();
  return record;
}

export function findMany(col, predicate = () => true) {
  const collection = ensureCollection(col);
  return collection.filter(predicate).map(r => ({ ...r }));
}

export function findOne(col, predicate) {
  const collection = ensureCollection(col);
  return collection.find(predicate) ?? null;
}

export async function updateOne(col, id, changes) {
  const collection = ensureCollection(col);
  const record = collection.find(r => r.id === id);
  if (!record) return null;

  Object.assign(record, changes, { updatedAt: new Date().toISOString() });
  await save();
  return record;
}

export async function deleteOne(col, id) {
  const collection = ensureCollection(col);
  const before = collection.length;
  const remaining = collection.filter(r => r.id !== id);
  const deleted = before - remaining.length;

  if (!deleted) return 0;

  getDoc()[col] = remaining;
  await save();
  return deleted; // 0 or number removed
}

// convenience: get all records in a collection
export function getAll(col) {
  return findMany(col);
}
