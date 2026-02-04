import mongoose from 'mongoose';
import { dbConnection } from '../model/connection.js';
import { Task } from '../model/task.model.js';

// Utility: ensure a value is an array (wrap single object, default to [])
const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
};

async function normalizeDelegates() {
  await dbConnection();

  let touchedTasks = 0;
  let fixedMainDelegates = 0;
  let fixedSubtaskDelegates = 0; 

  const cursor = Task.find({}).cursor();
  for (let task = await cursor.next(); task != null; task = await cursor.next()) {
    let changed = false;

    // Fix main task delegate
    if (!Array.isArray(task.delegate)) {
      task.delegate = toArray(task.delegate);
      fixedMainDelegates += 1;
      changed = true;
    }

    // Fix subtask delegates
    if (Array.isArray(task.subTasks)) {
      let subChanged = false;
      task.subTasks = task.subTasks.map((sub) => {
        if (!Array.isArray(sub.delegate)) {
          subChanged = true;
          return { ...sub.toObject?.() ?? sub, delegate: toArray(sub.delegate) };
        }
        return sub;
      });
      if (subChanged) {
        fixedSubtaskDelegates += 1;
        changed = true;
      }
    }

    if (changed) {
      touchedTasks += 1;
      await task.save();
    }
  }

  console.log('✅ Migration complete');
  console.log('Tasks updated:', touchedTasks);
  console.log('Main task delegates fixed:', fixedMainDelegates);
  console.log('Subtask delegates fixed (tasks with any fix):', fixedSubtaskDelegates);

  await mongoose.connection.close();
}

normalizeDelegates().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});


