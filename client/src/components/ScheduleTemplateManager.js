import React, { useEffect, useMemo, useState } from 'react';
import {
  getScheduleTemplates,
  createScheduleTemplate,
  updateScheduleTemplate,
  deleteScheduleTemplate,
  getScheduleTemplateAssignments,
  createScheduleTemplateAssignment,
  updateScheduleTemplateAssignment,
  deleteScheduleTemplateAssignment,
  getScheduleUsers
} from '../utils/api';
import TimePicker from './TimePicker';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const DEFAULT_BLOCKS = [
  { start: '08:00', end: '12:00' },
  { start: '12:30', end: '16:30' }
];

const TEMPLATE_PRESETS = [
  {
    name: 'Vollzeit 40h',
    description: 'Mo–Fr 08:00–12:00 + 12:30–16:30',
    days: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
      dayOfWeek,
      is_working: true,
      time_blocks: [...DEFAULT_BLOCKS]
    }))
  },
  {
    name: 'Teilzeit 30h',
    description: 'Mo–Do 08:30–15:30',
    days: [0, 1, 2, 3].map((dayOfWeek) => ({
      dayOfWeek,
      is_working: true,
      time_blocks: [{ start: '08:30', end: '15:30' }]
    }))
  },
  {
    name: 'Teilzeit 20h',
    description: 'Mo–Fr 08:00–12:00',
    days: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
      dayOfWeek,
      is_working: true,
      time_blocks: [{ start: '08:00', end: '12:00' }]
    }))
  }
];

const buildEmptyDays = () =>
  Array.from({ length: 7 }).map((_, idx) => ({
    dayOfWeek: idx,
    is_working: false,
    time_blocks: []
  }));

const toDraftFromTemplate = (template) => {
  const rawDays = template?.pattern?.days || template?.pattern?.Days || template?.days || [];
  const normalized = buildEmptyDays().map((day) => {
    const match = rawDays.find((d) => Number(d.dayOfWeek ?? d.day_of_week) === day.dayOfWeek);
    if (!match) return day;
    return {
      dayOfWeek: day.dayOfWeek,
      is_working: Boolean(match.is_working ?? match.isWorking),
      time_blocks: Array.isArray(match.time_blocks ?? match.timeBlocks)
        ? (match.time_blocks ?? match.timeBlocks).map((block) => ({ start: block.start, end: block.end }))
        : []
    };
  });

  return {
    id: template?.id,
    name: template?.name || '',
    description: template?.description || '',
    is_global: template?.is_global ?? true,
    is_default: template?.is_default ?? false,
    days: normalized
  };
};

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
};

const calcTemplateSummary = (days) => {
  let totalHours = 0;
  let workingDays = 0;
  days.forEach((day) => {
    if (day.is_working && day.time_blocks.length) {
      workingDays += 1;
      day.time_blocks.forEach((block) => {
        totalHours += calcHours(block.start, block.end);
      });
    }
  });
  return { totalHours: totalHours.toFixed(1), workingDays };
};

const ScheduleTemplateManager = () => {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateDraft, setTemplateDraft] = useState(toDraftFromTemplate(null));
  const [assignmentDraft, setAssignmentDraft] = useState({
    user_id: '',
    template_id: '',
    start_date: '',
    end_date: '',
    priority: 0,
    is_active: true
  });

  const loadTemplates = async () => {
    try {
      const response = await getScheduleTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Vorlagen konnten не geladen werden');
    }
  };

  const loadAssignments = async (userId = null) => {
    try {
      const response = await getScheduleTemplateAssignments(userId || undefined);
      setAssignments(response.data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
      toast.error('Regeln konnten nicht geladen werden');
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      const response = await getScheduleUsers();
      setUsers(response.data || []);
      if (!selectedUser && response.data?.length) {
        setSelectedUser(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Benutzer konnten не geladen werden');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTemplates(), loadUsers()])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAdmin && selectedUser?.id) {
      loadAssignments(selectedUser.id);
      return;
    }
    if (!isAdmin) {
      loadAssignments();
    }
  }, [selectedUser, isAdmin]);

  const templateSummary = useMemo(() => calcTemplateSummary(templateDraft.days), [templateDraft.days]);

  const handlePreset = (preset) => {
    const withDefaults = buildEmptyDays().map((day) => {
      const match = preset.days.find((d) => d.dayOfWeek === day.dayOfWeek);
      return match ? { ...match } : day;
    });
    setTemplateDraft((prev) => ({
      ...prev,
      name: preset.name,
      description: preset.description,
      days: withDefaults
    }));
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateDraft(toDraftFromTemplate(null));
    setShowTemplateModal(true);
  };

  const openEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateDraft(toDraftFromTemplate(template));
    setShowTemplateModal(true);
  };

  const saveTemplate = async () => {
    if (!templateDraft.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: templateDraft.name.trim(),
        description: templateDraft.description,
        is_global: templateDraft.is_global,
        is_default: templateDraft.is_default,
        pattern: { days: templateDraft.days }
      };

      if (editingTemplate?.id) {
        await updateScheduleTemplate(editingTemplate.id, payload);
        toast.success('Vorlage aktualisiert');
      } else {
        await createScheduleTemplate(payload);
        toast.success('Vorlage erstellt');
      }

      await loadTemplates();
      setShowTemplateModal(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (templateId) => {
    if (!window.confirm('Vorlage wirklich löschen?')) return;
    try {
      await deleteScheduleTemplate(templateId);
      toast.success('Vorlage gelöscht');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const openAssignmentModal = () => {
    setAssignmentDraft({
      user_id: selectedUser?.id || '',
      template_id: templates[0]?.id || '',
      start_date: '',
      end_date: '',
      priority: 0,
      is_active: true
    });
    setShowAssignmentModal(true);
  };

  const saveAssignment = async () => {
    if (!assignmentDraft.user_id || !assignmentDraft.template_id || !assignmentDraft.start_date) {
      toast.error('User, Vorlage und Startdatum sind erforderlich');
      return;
    }

    setSaving(true);
    try {
      if (assignmentDraft.id) {
        await updateScheduleTemplateAssignment(assignmentDraft.id, assignmentDraft);
        toast.success('Regel aktualisiert');
      } else {
        await createScheduleTemplateAssignment(assignmentDraft);
        toast.success('Regel erstellt');
      }

      if (selectedUser?.id) {
        await loadAssignments(selectedUser.id);
      }
      setShowAssignmentModal(false);
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignmentId) => {
    if (!window.confirm('Regel wirklich löschen?')) return;
    try {
      await deleteScheduleTemplateAssignment(assignmentId);
      toast.success('Regel gelöscht');
      if (selectedUser?.id) {
        loadAssignments(selectedUser.id);
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Lade Vorlagen...
      </div>
    );
  }

  return (
    <div className="schedule-template-manager grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Wochenvorlagen</h2>
            <p className="text-sm text-slate-500">Flexible Modelle für Teilzeit, Vollzeit und Saison.</p>
          </div>
          {isAdmin && (
            <button
              onClick={openCreateTemplate}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              Neue Vorlage
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => {
            const summary = calcTemplateSummary(template.pattern?.days || []);
            return (
              <div key={template.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{template.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                        {summary.workingDays} Tage · {summary.totalHours}h
                      </span>
                      {template.is_default && (
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Standard</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditTemplate(template)}
                        className="text-xs text-blue-600 font-semibold"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => removeTemplate(template.id)}
                        className="text-xs text-rose-500 font-semibold"
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Saison-Regeln</h2>
            <p className="text-sm text-slate-500">Welches шаблон gilt wann.</p>
          </div>
          {isAdmin && (
            <button
              onClick={openAssignmentModal}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
            >
              Regel hinzufügen
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mitarbeiter</label>
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const next = users.find((u) => String(u.id) === e.target.value);
                setSelectedUser(next || null);
              }}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}

        {assignments.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">
            Noch keine Regeln
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{assignment.template_name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {assignment.start_date} → {assignment.end_date || 'offen'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Priorität: {assignment.priority}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setAssignmentDraft(assignment);
                          setShowAssignmentModal(true);
                        }}
                        className="text-xs text-blue-600 font-semibold"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => removeAssignment(assignment.id)}
                        className="text-xs text-rose-500 font-semibold"
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTemplateModal && (
        <div className="modal-shell fixed inset-0 bg-black/50 z-[50000] flex items-center justify-center p-4">
          <div className="modal-card bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
                </h3>
                <p className="text-xs text-slate-500">Definiere Arbeitszeiten je Wochentag.</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-500">×</button>
            </div>
            <div className="modal-scroll p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Name</label>
                  <input
                    value={templateDraft.name}
                    onChange={(e) => setTemplateDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Beschreibung</label>
                  <input
                    value={templateDraft.description}
                    onChange={(e) => setTemplateDraft((prev) => ({ ...prev, description: e.target.value }))}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {TEMPLATE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePreset(preset)}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={templateDraft.is_global}
                    onChange={(e) => setTemplateDraft((prev) => ({ ...prev, is_global: e.target.checked }))}
                  />
                  Global sichtbar
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={templateDraft.is_default}
                    onChange={(e) => setTemplateDraft((prev) => ({ ...prev, is_default: e.target.checked }))}
                  />
                  Standard‑Vorlage
                </label>
                <span className="ml-auto text-xs text-slate-500">
                  {templateSummary.workingDays} Tage · {templateSummary.totalHours}h
                </span>
              </div>

              <div className="space-y-3">
                {templateDraft.days.map((day, idx) => (
                  <div key={day.dayOfWeek} className="border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-slate-900">{DAYS[idx]}</div>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={day.is_working}
                          onChange={(e) => {
                            const next = [...templateDraft.days];
                            next[idx] = {
                              ...next[idx],
                              is_working: e.target.checked,
                              time_blocks: e.target.checked ? (next[idx].time_blocks.length ? next[idx].time_blocks : [{ start: '08:00', end: '12:00' }]) : []
                            };
                            setTemplateDraft((prev) => ({ ...prev, days: next }));
                          }}
                        />
                        Arbeitstag
                      </label>
                    </div>

                    {day.is_working ? (
                      <div className="space-y-2">
                        {day.time_blocks.map((block, blockIdx) => (
                          <div key={blockIdx} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <TimePicker
                              label="Start"
                              value={block.start}
                              onChange={(value) => {
                                const next = [...templateDraft.days];
                                next[idx].time_blocks[blockIdx].start = value;
                                setTemplateDraft((prev) => ({ ...prev, days: next }));
                              }}
                            />
                            <TimePicker
                              label="Ende"
                              value={block.end}
                              onChange={(value) => {
                                const next = [...templateDraft.days];
                                next[idx].time_blocks[blockIdx].end = value;
                                setTemplateDraft((prev) => ({ ...prev, days: next }));
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...templateDraft.days];
                                next[idx].time_blocks = next[idx].time_blocks.filter((_, i) => i !== blockIdx);
                                if (next[idx].time_blocks.length === 0) next[idx].is_working = false;
                                setTemplateDraft((prev) => ({ ...prev, days: next }));
                              }}
                              className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold"
                            >
                              Entfernen
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...templateDraft.days];
                            next[idx].time_blocks.push({ start: '08:00', end: '12:00' });
                            setTemplateDraft((prev) => ({ ...prev, days: next }));
                          }}
                          className="text-xs text-blue-600 font-semibold"
                        >
                          + Zeitblock
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Frei</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignmentModal && (
        <div className="modal-shell fixed inset-0 bg-black/50 z-[50000] flex items-center justify-center p-4">
          <div className="modal-card bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Saison-Regel</h3>
              <button onClick={() => setShowAssignmentModal(false)} className="text-slate-500">×</button>
            </div>
            <div className="modal-scroll p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Mitarbeiter</label>
                <select
                  value={assignmentDraft.user_id}
                  onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, user_id: e.target.value }))}
                  className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Vorlage</label>
                <select
                  value={assignmentDraft.template_id}
                  onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, template_id: e.target.value }))}
                  className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Start</label>
                  <input
                    type="date"
                    value={assignmentDraft.start_date || ''}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Ende (optional)</label>
                  <input
                    type="date"
                    value={assignmentDraft.end_date || ''}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Priorität</label>
                  <input
                    type="number"
                    value={assignmentDraft.priority}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, priority: e.target.value }))}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    checked={assignmentDraft.is_active}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-600">Aktiv</span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={saveAssignment}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleTemplateManager;
