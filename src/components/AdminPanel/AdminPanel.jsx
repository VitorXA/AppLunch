import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { errorMessage, strings } from '../../strings';
import './AdminPanel.css';

export default function AdminPanel() {
  const [date, setDate] = useState(''); // vazio = "hoje" no fuso do servidor
  const [result, setResult] = useState({ for: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .adminMeals(date)
      .then((data) => !cancelled && setResult({ for: date, data, error: null }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ for: date, data: null, error: errorMessage(err instanceof ApiError ? err.code : 'unknown') }),
      );
    return () => {
      cancelled = true;
    };
  }, [date]);

  const { data, error } = result;
  const loading = result.for !== date;
  const labelOf = (id) => data?.meals.find((m) => m.id === id)?.label ?? id;

  return (
    <section className="AdminPanel">
      <h1>{strings.admin.title}</h1>
      <label className="AdminDate">
        {strings.admin.date}
        <input type="date" value={date || data?.date || ''} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading && <p>{strings.loading}</p>}
      {!loading && error && <p className="Feedback error">{error}</p>}

      {!loading && data && (
        <>
          <ul className="Totals">
            {data.meals.map((m) => (
              <li key={m.id}>
                {m.label}: <strong>{data.totals[m.id] ?? 0}</strong>
              </li>
            ))}
          </ul>
          {data.entries.length === 0 ? (
            <p>{strings.admin.empty}</p>
          ) : (
            <div className="TableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{strings.admin.columns.who}</th>
                    <th>{strings.admin.columns.identifier}</th>
                    <th>{strings.admin.columns.meal}</th>
                    <th>{strings.admin.columns.time}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td>{e.identifier}</td>
                      <td>{labelOf(e.mealType)}</td>
                      <td>{new Date(e.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
