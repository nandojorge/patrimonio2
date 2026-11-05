/* Teste isolado: pré-preenche o formulário AppGyver na própria página.
 * Não envia dados, não clica em Guardar e não altera o código compilado. */
(() => {
  'use strict';

  const params = new URLSearchParams(location.hash.slice(1));
  const validAccounts = new Set(['Ana', 'Nando', 'Vivus', 'Dinheiro Pessoal', 'Dinheiro Vivus', 'Ana CTR', 'Acertos']);
  const amount = params.get('valor') || '';
  const date = params.get('data') || '';
  const description = (params.get('descricao') || '').trim().slice(0, 180);
  const account = params.get('conta') || 'Vivus';
  const kind = params.get('tipo') || 'Saída';
  const owner = params.get('titularidade') || 'Vivusfisio';

  const validAmount = /^\d{1,7}(?:[.,]\d{1,2})?$/.test(amount) && Number(amount.replace(',', '.')) > 0;
  const dateObj = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  const validDate = dateObj && !Number.isNaN(dateObj.getTime()) && dateObj.toISOString().slice(0, 10) === date;
  if (!validAmount || !validDate || !description || !validAccounts.has(account) ||
      !['Saída', 'Entrada'].includes(kind) || !['Vivusfisio', 'Pessoal'].includes(owner)) return;

  const expectedAmount = Number(amount.replace(',', '.')).toFixed(2);
  const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
  const leaf = text => [...document.querySelectorAll('div[dir="auto"]')]
    .find(el => el.children.length === 0 && el.textContent.trim() === text);
  const selectContaining = label => [...document.querySelectorAll('select')]
    .find(s => [...s.options].some(o => o.textContent.trim() === label));

  function setInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function choose(select, label) {
    if (!select) return false;
    const option = [...select.options].find(o => o.textContent.trim() === label);
    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function press(text) {
    const button = leaf(text)?.closest('[tabindex="0"]');
    if (!button) return false;
    button.click();
    return true;
  }
  async function chooseDate() {
    const [year, month, day] = date.split('-').map(Number);
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const open = leaf('Data do Movimento')?.parentElement?.parentElement?.querySelector('[tabindex="0"]');
    if (!open) return false;
    open.click();
    await tick(150);
    if (!choose(selectContaining(String(year)), String(year))) return false;
    await tick(150);
    if (!choose(selectContaining('Janeiro'), months[month - 1])) return false;
    await tick(200);

    const dayButtons = [...document.querySelectorAll('[tabindex="0"]')].filter(el => {
      if (el.textContent.trim() !== String(day)) return false;
      const n = el.querySelector('div[dir="auto"]');
      return n && n.textContent.trim() === String(day) && n.style.color === 'rgb(50, 54, 58)';
    });
    if (dayButtons.length !== 1) return false;
    dayButtons[0].click();
    await tick(160);
    const expected = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
    const current = () => leaf('Data do Movimento')?.parentElement?.parentElement?.querySelector('[tabindex="0"]')?.textContent || '';
    if (current().includes(expected)) return true;
    // O calendário pode primeiro realçar o dia e só aplicar a data no segundo toque.
    const second = [...document.querySelectorAll('[tabindex="0"]')].find(el => {
      if (el.textContent.trim() !== String(day)) return false;
      const n = el.querySelector('div[dir="auto"]');
      return n && n.textContent.trim() === String(day) && n.style.color === 'rgb(50, 54, 58)';
    });
    if (second) {
      // O toque real incide sobre o número (div interior), não na célula exterior.
      const target = second.querySelector('div[dir="auto"]') || second;
      target.click();
      await tick(180);
      if (!current().includes(expected)) {
        const opt = { bubbles: true, cancelable: true, button: 0, view: window };
        target.dispatchEvent(new MouseEvent('mousedown', { ...opt, buttons: 1 }));
        target.dispatchEvent(new MouseEvent('mouseup', { ...opt, buttons: 0 }));
        target.dispatchEvent(new MouseEvent('click', opt));
        await tick(180);
      }
    }
    return current().includes(expected);
  }

  function makeNotice() {
    const box = document.createElement('div');
    box.id = 'prefill-notice';
    Object.assign(box.style, {
      position: 'fixed', zIndex: '99999', right: '12px', bottom: '12px',
      padding: '10px 12px', borderRadius: '8px', background: '#fff',
      color: '#172b3b', boxShadow: '0 3px 16px #0003',
      font: '13px system-ui, sans-serif', maxWidth: '350px'
    });
    const state = document.createElement('span');
    state.textContent = 'A preencher…';
    box.append(state);
    const back = document.createElement('a');
    back.href = 'page.Page1.html';
    back.textContent = 'Voltar às Despesas';
    Object.assign(back.style, { display: 'block', marginTop: '6px', color: '#07598e' });
    box.append(back);
    document.body.append(box);
    const leaveCheck = setInterval(() => {
      if (!location.pathname.endsWith('/page.Page2.html')) {
        clearInterval(leaveCheck);
        box.remove();
      }
    }, 500);
    return state;
  }

  window.addEventListener('load', async () => {
    // O aviso é separado do formulário e contém uma alternativa caso a app
    // não navegue após gravar. Não dispara qualquer ação de gravação.
    const state = makeNotice();
    for (let i = 0; i < 80; i++) {
      const inputs = document.querySelectorAll('input[type="text"]');
      if (inputs.length < 2 || !leaf('Data do Movimento') || !selectContaining('Vivus')) {
        await tick(250);
        continue;
      }
      try {
        const kindOK = press(kind);
        await tick(120);
        const ownerOK = press(owner);
        await tick(120);
        const freshInputs = document.querySelectorAll('input[type="text"]');
        setInput(freshInputs[0], expectedAmount);
        setInput(freshInputs[1], description);
        await tick(120);
        const dateOK = await chooseDate();
        await tick(120);
        const accountOK = choose(selectContaining('Vivus'), account);
        await tick(300);
        const currentInputs = document.querySelectorAll('input[type="text"]');
        const valuesOK = currentInputs[0]?.value === expectedAmount && currentInputs[1]?.value === description;
        const selectedAccount = selectContaining('Vivus')?.selectedOptions[0]?.textContent.trim();
        if (!dateOK) {
          state.textContent = `Atenção: escolhe manualmente a data ${date.split('-').reverse().join('-')} no calendário e confirma os outros campos antes de gravar.`;
        } else {
          state.textContent = kindOK && ownerOK && accountOK && valuesOK && selectedAccount === account
            ? 'Dados preenchidos. Confirma, escolhe a categoria e grava.'
            : 'Confirma todos os campos: o pré-preenchimento foi parcial.';
        }
      } catch {
        state.textContent = 'Não foi possível preencher tudo. Confirma manualmente.';
      }
      return;
    }
    state.textContent = 'A app demorou demasiado a carregar.';
  }, { once: true });
})();
