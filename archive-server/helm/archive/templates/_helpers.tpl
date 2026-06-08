{{/*
Expand the name of the chart.
*/}}
{{- define "archive.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this
(by the DNS naming spec).  If release name contains chart name it will be used
as a full name.
*/}}
{{- define "archive.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label (chart name + version).
*/}}
{{- define "archive.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "archive.labels" -}}
helm.sh/chart: {{ include "archive.chart" . }}
{{ include "archive.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels — used in matchLabels and Service selectors.
*/}}
{{- define "archive.selectorLabels" -}}
app.kubernetes.io/name: {{ include "archive.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Component-scoped selector labels.
Usage: {{ include "archive.componentLabels" (dict "component" "server" "ctx" .) }}
*/}}
{{- define "archive.componentLabels" -}}
app.kubernetes.io/name: {{ include "archive.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Namespace helper — returns the configured namespace name.
*/}}
{{- define "archive.namespace" -}}
{{- .Values.namespace.name | default "archive" }}
{{- end }}

{{/*
Secret name.
*/}}
{{- define "archive.secretName" -}}
{{- printf "%s-secrets" (include "archive.fullname" .) }}
{{- end }}

{{/*
ConfigMap name.
*/}}
{{- define "archive.configmapName" -}}
{{- printf "%s-config" (include "archive.fullname" .) }}
{{- end }}

{{/*
Image pull secrets block (empty when .Values.image.pullSecrets is []).
*/}}
{{- define "archive.imagePullSecrets" -}}
{{- if .Values.image.pullSecrets }}
imagePullSecrets:
{{- range .Values.image.pullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}
