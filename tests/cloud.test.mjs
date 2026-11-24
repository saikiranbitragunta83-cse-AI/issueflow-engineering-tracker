import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudConfigured, fromRow, toRow, rowNumber } from '../assets/cloud.js';
const backend={id:17,title:'Review deployment',description:'Security review',status:'review',priority:'critical',assignee:'Sam',due_date:'2026-12-03',tags:['security'],created_at:'2026-11-22T10:00:00.000Z',updated_at:'2026-11-23T10:00:00.000Z'};
test('guest mode remains available before cloud configuration',()=>assert.equal(cloudConfigured(),false));
test('server issue becomes validated UI task',()=>{const task=fromRow(backend);assert.equal(task.id,'IF-17');assert.equal(task.title,'Review deployment');assert.equal(task.due,'2026-12-03');});
test('UI task converts to database shape without exposing private client keys',()=>{const row=toRow(fromRow(backend),'workspace-id');assert.equal(row.workspace_id,'workspace-id');assert.deepEqual(row.tags,['security']);assert.equal(row.due_date,'2026-12-03');assert.ok(!('created_by' in row));});
test('issue id validation prevents invalid SQL lookup',()=>{assert.equal(rowNumber('IF-17'),17);assert.throws(()=>rowNumber('IF-xx'));});
