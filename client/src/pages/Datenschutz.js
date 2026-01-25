import React from 'react';
import { Shield, Lock, Server, Database, Eye, FileText } from 'lucide-react';

const Datenschutz = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white text-center">Datenschutzerklärung</h1>
          <p className="text-blue-100 text-center mt-4 text-lg">Ihre Daten sind bei uns sicher</p>
        </div>

        <div className="px-8 py-10 space-y-8">
          {/* Security Overview */}
          <section className="border-l-4 border-blue-500 pl-6">
            <div className="flex items-center mb-4">
              <Lock className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Sicherheit Ihrer Daten</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Der Biolab Logistik Planner wird auf einem <strong>sicheren, geschützten Server</strong> gehostet. 
              Alle Datenübertragungen werden durch moderne <strong>Verschlüsselungstechnologien</strong> geschützt.
            </p>
          </section>

          {/* Encryption */}
          <section className="border-l-4 border-green-500 pl-6">
            <div className="flex items-center mb-4">
              <Server className="w-6 h-6 text-green-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Verschlüsselung</h2>
            </div>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                <span><strong>SSL/TLS-Verschlüsselung:</strong> Alle Verbindungen sind verschlüsselt</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                <span><strong>Passwort-Hashing:</strong> Passwörter werden sicher gehasht und niemals im Klartext gespeichert</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                <span><strong>Sichere Authentifizierung:</strong> JWT-basierte Authentifizierung mit Ablaufzeit</span>
              </li>
            </ul>
          </section>

          {/* Data Storage */}
          <section className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center mb-4">
              <Database className="w-6 h-6 text-purple-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Datenspeicherung</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Ihre Daten werden in einer <strong>sicheren PostgreSQL-Datenbank</strong> auf einem geschützten Server gespeichert:
            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">•</span>
                <span>Regelmäßige Backups Ihrer Daten</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">•</span>
                <span>Zugriffskontrolle und Berechtigungsverwaltung</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">•</span>
                <span>Daten werden nur so lange gespeichert, wie es für den Betrieb erforderlich ist</span>
              </li>
            </ul>
          </section>

          {/* Data Access */}
          <section className="border-l-4 border-orange-500 pl-6">
            <div className="flex items-center mb-4">
              <Eye className="w-6 h-6 text-orange-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Wer hat Zugriff auf Ihre Daten?</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Nur <strong>autorisierte Administratoren</strong> haben Zugriff auf das System:
            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-orange-600 mr-2">•</span>
                <span>Superadmin: Vollzugriff zur Systemverwaltung</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-600 mr-2">•</span>
                <span>Admin: Eingeschränkter Zugriff für Benutzerverwaltung</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-600 mr-2">•</span>
                <span>Mitarbeiter: Zugriff nur auf eigene Daten und freigegebene Informationen</span>
              </li>
            </ul>
          </section>

          {/* Data Collected */}
          <section className="border-l-4 border-blue-500 pl-6">
            <div className="flex items-center mb-4">
              <FileText className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Welche Daten werden gespeichert?</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Wir speichern nur die Daten, die für den Betrieb der Anwendung notwendig sind:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>• Benutzerprofildaten (Name, E-Mail, Telefon, Adresse)</li>
              <li>• Beschäftigungsinformationen (Typ, Arbeitszeiten)</li>
              <li>• Nachrichten und Konversationen innerhalb des Systems</li>
              <li>• Kalendereinträge und Aufgaben</li>
              <li>• Abfallmanagement-Daten</li>
              <li>• Profilfotos und hochgeladene Dateien</li>
              <li>• Login-Informationen und Zugriffsprotokolle</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ihre Rechte</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Sie haben das Recht:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>• Auf Auskunft über Ihre gespeicherten Daten</li>
              <li>• Auf Berichtigung falscher Daten</li>
              <li>• Auf Löschung Ihrer Daten (unter bestimmten Voraussetzungen)</li>
              <li>• Auf Einschränkung der Verarbeitung</li>
              <li>• Auf Datenübertragbarkeit</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="text-center pt-8 border-t border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Fragen zum Datenschutz?</h3>
            <p className="text-gray-600">
              Bei Fragen zur Verarbeitung Ihrer Daten wenden Sie sich bitte an Ihren Systemadministrator.
            </p>
          </section>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 pt-6 border-t border-gray-200">
            <p>Stand: Januar 2026</p>
            <p className="mt-2">Biolab Logistik Planner - Sichere Verwaltung Ihrer Daten</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Datenschutz;
