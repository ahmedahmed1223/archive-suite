<?php
namespace Tests\Feature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;
class ProjectTasksApiTest extends TestCase { use RefreshDatabase, AuthenticatesArchiveRequests;
 public function test_it_persists_a_project_task_with_assignment_status_and_optional_record(): void {
  $project=$this->postJson('/api/v1/projects',['name'=>'مشروع'],$this->authHeaders())->json('project');
  $task=$this->postJson('/api/v1/project-tasks',['projectId'=>$project['id'],'title'=>'مراجعة الوصف','status'=>'review','assignee'=>'فريق التوثيق','recordId'=>'record-1','dueDate'=>'2026-08-15'],$this->authHeaders())->assertCreated()->assertJsonPath('task.status','review')->assertJsonPath('task.recordId','record-1')->json('task');
  $this->patchJson('/api/v1/project-tasks/'.$task['id'],['status'=>'done'],$this->authHeaders())->assertOk()->assertJsonPath('task.status','done');
  $this->getJson('/api/v1/project-tasks?projectId='.$project['id'],$this->authHeaders())->assertOk()->assertJsonCount(1,'tasks');
 }}
