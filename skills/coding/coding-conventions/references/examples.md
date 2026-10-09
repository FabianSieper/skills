# Beispiele und Grenzen

Die Beispiele erklären Entscheidungen. Sie schreiben keine Programmiersprache oder Architektur vor.

## Einheit sichtbar machen

Unklar:
```ts
const timeout = 5_000;
```
Konkreter, wenn Millisekunden gemeint sind:
```ts
const requestTimeoutMs = 5_000;
```
Die tatsächliche Einheit zuerst aus Vertrag oder Verwendung bestimmen. Nicht aus dem Zahlenwert raten. Bei einem etablierten Typ wie `Duration` kann die Einheit bereits eindeutig modelliert sein.

## Fachliche Absicht statt bloßer Formel

Unklar:
```ts
const result = users.filter(u => u.active && u.emailVerified);
```
Konkreter, sofern genau diese Definition fachlich gilt:
```ts
const eligibleUsers = users.filter(user => user.active && user.emailVerified);
```
`eligibleUsers` ist nur dann ein guter Name, wenn der Kontext erklärt, wofür die Nutzer berechtigt sind. Nicht einfach kryptische Kurzformen durch erfundene Fachsprache ersetzen. Einen Helfer nur einführen, wenn er tatsächlich Bedeutung oder Wiederverwendung schafft.

## Grund bewahren

Redundant:
```ts
// Increase the attempt count.
attemptCount += 1;
```
Nützlicher Kontext:
```ts
// The upstream service can return the previous result briefly after a write.
await waitForConsistencyWindow();
```
Den zweiten Kommentar nicht entfernen, nur weil die Funktion gut benannt ist. Eine öffentliche Schnittstelle kann weiterhin Einheiten, Fehler und Seiteneffekte dokumentieren müssen.

## Keine Abstraktion um ihrer selbst willen

Einmaliger, klarer Kontrollfluss benötigt nicht automatisch Factory, Strategy und Interface. Umgekehrt sind vorhandene bewährte Grenzen kein Anlass für pauschales Zusammenlegen. Entscheidung nach Verständlichkeit, Invarianten und Auftrag treffen.

## Refactoring darf Reihenfolge nicht heimlich ändern

Das Umbenennen oder Extrahieren einer Methode darf Prüfung, Persistierung und Benachrichtigung nicht neu ordnen. Auch ein ungewöhnlicher bestehender Fehlervertrag ist beobachtbares Verhalten; eine gewollte Korrektur gesondert begründen und testen.
