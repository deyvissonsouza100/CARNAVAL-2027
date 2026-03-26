import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

const state = {
  currentTab: 'blocos',
  session: null,
  supabase: null,
  data: {
    blocos: [],
    alteracoes: [],
    status: [],
    levantamento: []
  }
};

const el = {
  siteTitle: document.getElementById('siteTitle'),
  loginSection: document.getElementById('loginSection'),
  dashboardSection: document.getElementById('dashboardSection'),
  loginForm: document.getElementById('loginForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  sessionBadge: document.getElementById('sessionBadge'),
  navTabs: document.getElementById('navTabs'),
  searchInput: document.getElementById('searchInput'),
  regionalFilter: document.getElementById('regionalFilter'),
  statusFilter: document.getElementById('statusFilter'),
  dateFilter: document.getElementById('dateFilter'),
  summaryCards: document.getElementById('summaryCards'),
  blocosTableWrap: document.getElementById('blocosTableWrap'),
  alteracoesTableWrap: document.getElementById('alteracoesTableWrap'),
  statusTableWrap: document.getElementById('statusTableWrap'),
  levantamentoTableWrap: document.getElementById('levantamentoTableWrap'),
  blocksCount: document.getElementById('blocksCount'),
  changesCount: document.getElementById('changesCount'),
  planningModal: document.getElementById('planningModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  planningForm: document.getElementById('planningForm'),
  modalTitle: document.getElementById('modalTitle'),
  modalBlockId: document.getElementById('modalBlockId'),
  toast: document.getElementById('toast')
};

const planningFields = {
  situacao_do_plano: document.getElementById('situacaoDoPlano'),
  numero_plano_emprego_operacional: document.getElementById('numeroPlano'),
  equipe_empenhada: document.getElementById('equipeEmpenhada'),
  prioridade_dsub: document.getElementById('prioridadeDsub'),
  apoio_gcmbh: document.getElementById('apoioGcmbh'),
  informacoes: document.getElementById('informacoesPlanejamento'),
  qtd_transito: document.getElementById('qtdTransito'),
  qtd_dme: document.getElementById('qtdDme'),
  qtd_gtur: document.getElementById('qtdGtur'),
  qtd_gepam: document.getElementById('qtdGepam'),
  qtd_gpir: document.getElementById('qtdGpir'),
  qtd_outros: document.getElementById('qtdOutros'),
  qtd_dma: document.getElementById('qtdDma'),
  qtd_norte: document.getElementById('qtdNorte'),
  qtd_venda_nova: document.getElementById('qtdVendaNova'),
  qtd_pampulha: document.getElementById('qtdPampulha'),
  qtd_leste: document.getElementById('qtdLeste'),
  qtd_nordeste: document.getElementById('qtdNordeste'),
  qtd_barreiro: document.getElementById('qtdBarreiro'),
  qtd_oeste: document.getElementById('qtdOeste'),
  qtd_noroeste: document.getElementById('qtdNoroeste'),
  qtd_centro_sul: document.getElementById('qtdCentroSul'),
  qtd_hipercentro: document.getElementById('qtdHipercentro')
};

function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  el.toast.style.borderColor = isError ? 'rgba(255,107,107,.28)' : 'rgba(61,214,208,.28)';
  el.toast.style.color = isError ? '#ffe2e2' : '#e4fffe';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 3500);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugStatus(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(' ', '-');
}

function statusChip(value) {
  const label = value || 'SEM PLANO';
  const css = slugStatus(label);
  return `<span class="status-chip ${css}">${escapeHtml(label)}</span>`;
}

function impactChip(value) {
  const label = value || 'medio';
  return `<span class="impact-chip ${slugStatus(label)}">${escapeHtml(label)}</span>`;
}

function getCurrentStatus(item) {
  return item.status_novo || item.status_atual || '';
}

function faixaPublicoLabel(item) {
  const publico = Number(item.publico_planejado || item.publico_declarado || 0);
  if (publico <= 1000) return 'ATÉ 1.000';
  if (publico <= 5000) return '1.001 A 5.000';
  if (publico <= 10000) return '5.001 A 10.000';
  if (publico <= 20000) return '10.001 A 20.000';
  return 'ACIMA DE 20.000';
}

function empenhosResumo(item) {
  const mapa = [
    ['TRÂNSITO', item.qtd_transito],
    ['DME', item.qtd_dme],
    ['GTUR', item.qtd_gtur],
    ['GEPAM', item.qtd_gepam],
    ['GPIR', item.qtd_gpir],
    ['OUTROS', item.qtd_outros],
    ['DMA', item.qtd_dma],
    ['NORTE', item.qtd_norte],
    ['VENDA NOVA', item.qtd_venda_nova],
    ['PAMPULHA', item.qtd_pampulha],
    ['LESTE', item.qtd_leste],
    ['NORDESTE', item.qtd_nordeste],
    ['BARREIRO', item.qtd_barreiro],
    ['OESTE', item.qtd_oeste],
    ['NOROESTE', item.qtd_noroeste],
    ['CENTRO SUL', item.qtd_centro_sul],
    ['HIPERCENTRO', item.qtd_hipercentro]
  ];
  const ativos = mapa
    .map(([nome, valor]) => [nome, Number(valor || 0)])
    .filter(([, valor]) => valor > 0)
    .map(([nome, valor]) => `${nome} ${valor}`);

  return ativos.length ? ativos.join(' • ') : 'Sem empenhos lançados';
}

function filteredBlocos() {
  const search = el.searchInput.value.trim().toLowerCase();
  const regional = el.regionalFilter.value;
  const status = el.statusFilter.value;
  const date = el.dateFilter.value;

  return state.data.blocos.filter(item => {
    const matchesSearch =
      !search ||
      String(item.nome_do_bloco || '').toLowerCase().includes(search) ||
      String(item.numero_inscricao || '').toLowerCase().includes(search);

    const matchesRegional = !regional || item.regional_atual === regional;
    const matchesStatus = !status || item.status_novo === status || item.status_atual === status;
    const matchesDate = !date || item.data_do_desfile === date;

    return matchesSearch && matchesRegional && matchesStatus && matchesDate;
  });
}

function renderSummary() {
  const data = filteredBlocos();
  const total = data.length;
  const aprovados = data.filter(i => getCurrentStatus(i) === 'APROVADO').length;
  const revisao = data.filter(i => i.precisa_revisao_planejamento && getCurrentStatus(i) === 'APROVADO').length;
  const efetivo = data.reduce((acc, cur) => acc + Number(cur.total_agentes_empenhados || 0), 0);

  el.summaryCards.innerHTML = `
    <article class="summary-card">
      <h3>Total de blocos</h3>
      <strong>${formatNumber(total)}</strong>
      <small>Após filtros aplicados</small>
    </article>
    <article class="summary-card">
      <h3>Aprovados</h3>
      <strong>${formatNumber(aprovados)}</strong>
      <small>Status mais recente</small>
    </article>
    <article class="summary-card">
      <h3>Precisam revisão</h3>
      <strong>${formatNumber(revisao)}</strong>
      <small>Somente aprovados alterados</small>
    </article>
    <article class="summary-card">
      <h3>Efetivo empenhado</h3>
      <strong>${formatNumber(efetivo)}</strong>
      <small>Total somado do planejamento</small>
    </article>
  `;
}

function renderBlocos() {
  const rows = filteredBlocos();
  el.blocksCount.textContent = `${rows.length} blocos`;
  if (!rows.length) {
    el.blocosTableWrap.innerHTML = `<div class="empty-state">Nenhum bloco encontrado com os filtros atuais.</div>`;
    return;
  }

  el.blocosTableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Bloco</th>
          <th>Data</th>
          <th>Regional</th>
          <th>Faixa de público</th>
          <th>Status antigo</th>
          <th>Status novo</th>
          <th>Situação do plano</th>
          <th>Nº do plano</th>
          <th>Prioridade DSUB</th>
          <th>Empenhos</th>
          <th>Efetivo</th>
          <th>Revisão</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(item => `
          <tr>
            <td>
              <strong>${escapeHtml(item.nome_do_bloco)}</strong>
              <div class="secondary">Inscrição: ${escapeHtml(item.numero_inscricao || '—')}</div>
            </td>
            <td>${formatDate(item.data_do_desfile)}</td>
            <td>${escapeHtml(item.regional_atual || '—')}</td>
            <td>${escapeHtml(item.faixa_publico || faixaPublicoLabel(item))}</td>
            <td>${statusChip(item.status_antigo || 'SEM HISTÓRICO')}</td>
            <td>${statusChip(getCurrentStatus(item))}</td>
            <td>${statusChip(item.situacao_do_plano || 'SEM PLANO')}</td>
            <td>${escapeHtml(item.numero_plano_emprego_operacional || '—')}</td>
            <td>${escapeHtml(item.prioridade_dsub || '—')}</td>
            <td><div class="secondary empenhos-cell">${escapeHtml(empenhosResumo(item))}</div></td>
            <td>${formatNumber(item.total_agentes_empenhados || 0)}</td>
            <td>${item.precisa_revisao_planejamento && getCurrentStatus(item) === 'APROVADO' ? '<span class="revision-flag">Precisa revisar</span>' : 'OK'}</td>
            <td>
              <button class="action-btn" type="button" data-open-planning="${item.bloco_consolidado_id}">
                Editar
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAlteracoes() {
  const rows = state.data.alteracoes;
  el.changesCount.textContent = `${rows.length} alterações`;
  if (!rows.length) {
    el.alteracoesTableWrap.innerHTML = `<div class="empty-state">Nenhuma alteração detectada até o momento.</div>`;
    return;
  }

  el.alteracoesTableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Bloco</th>
          <th>Tipo</th>
          <th>Status anterior</th>
          <th>Status atual</th>
          <th>Impacto</th>
          <th>Situação do plano</th>
          <th>Revisado</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(item => `
          <tr>
            <td>
              <strong>${escapeHtml(item.nome_do_bloco || '—')}</strong>
              <div class="secondary">${escapeHtml(item.numero_inscricao || '—')}</div>
            </td>
            <td>${escapeHtml(item.tipo_alteracao || '—')}</td>
            <td>${statusChip(item.status_anterior || '—')}</td>
            <td>${statusChip(item.status_atual || '—')}</td>
            <td>${impactChip(item.impacto_operacional)}</td>
            <td>${statusChip(item.situacao_do_plano || 'SEM PLANO')}</td>
            <td>${item.revisado ? 'Sim' : 'Não'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderStatus() {
  const rows = state.data.status;
  if (!rows.length) {
    el.statusTableWrap.innerHTML = `<div class="empty-state">Sem dados de status.</div>`;
    return;
  }

  el.statusTableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Total</th>
          <th>Aprovados</th>
          <th>Cadastrados</th>
          <th>Cancelados</th>
          <th>Com plano</th>
          <th>Sem plano</th>
          <th>Efetivo</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(item => `
          <tr>
            <td>${formatDate(item.data_do_desfile)}</td>
            <td>${formatNumber(item.total_blocos)}</td>
            <td>${formatNumber(item.total_aprovados)}</td>
            <td>${formatNumber(item.total_cadastrados)}</td>
            <td>${formatNumber(item.total_cancelados)}</td>
            <td>${formatNumber(item.total_com_plano)}</td>
            <td>${formatNumber(item.total_sem_plano)}</td>
            <td>${formatNumber(item.efetivo_total_empenhado)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderLevantamento() {
  const rows = state.data.levantamento;
  if (!rows.length) {
    el.levantamentoTableWrap.innerHTML = `<div class="empty-state">Sem dados de levantamento.</div>`;
    return;
  }

  el.levantamentoTableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Regional</th>
          <th>Perfil</th>
          <th>Faixa de público</th>
          <th>Total blocos</th>
          <th>Aprovados</th>
          <th>Cadastrados</th>
          <th>Cancelados</th>
          <th>Efetivo</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(item => `
          <tr>
            <td>${formatDate(item.data_do_desfile)}</td>
            <td>${escapeHtml(item.regional)}</td>
            <td>${escapeHtml(item.perfil)}</td>
            <td>${escapeHtml(item.faixa_publico)}</td>
            <td>${formatNumber(item.total_blocos)}</td>
            <td>${formatNumber(item.total_aprovados)}</td>
            <td>${formatNumber(item.total_cadastrados)}</td>
            <td>${formatNumber(item.total_cancelados)}</td>
            <td>${formatNumber(item.efetivo_total_empenhado)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function fillRegionalFilter() {
  const regionais = [...new Set(state.data.blocos.map(i => i.regional_atual).filter(Boolean))].sort();
  const current = el.regionalFilter.value;
  el.regionalFilter.innerHTML = `<option value="">Todas</option>` + regionais.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
  el.regionalFilter.value = current;
}

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
}

async function loadData() {
  const client = state.supabase;
  const [blocos, alteracoes, status, levantamento] = await Promise.all([
    client.from('vw_blocos_regionais_atual').select('*').order('data_do_desfile', { ascending: true }).order('nome_do_bloco', { ascending: true }),
    client.from('vw_alteracoes_semana').select('*').order('data_alteracao', { ascending: false }),
    client.from('vw_status_blocos').select('*').order('data_do_desfile', { ascending: true }),
    client.from('vw_levantamento_blocos').select('*').order('data_do_desfile', { ascending: true })
  ]);

  const hasError = [blocos, alteracoes, status, levantamento].find(r => r.error);
  if (hasError) throw hasError.error;

  state.data.blocos = blocos.data || [];
  state.data.alteracoes = alteracoes.data || [];
  state.data.status = status.data || [];
  state.data.levantamento = levantamento.data || [];

  fillRegionalFilter();
  renderAll();
}

function renderAll() {
  renderSummary();
  renderBlocos();
  renderAlteracoes();
  renderStatus();
  renderLevantamento();
}

function openPlanningModal(blockId) {
  const record = state.data.blocos.find(i => i.bloco_consolidado_id === blockId);
  if (!record) return;

  el.modalTitle.textContent = `Planejamento • ${record.nome_do_bloco}`;
  el.modalBlockId.value = record.bloco_consolidado_id;

  planningFields.situacao_do_plano.value = record.situacao_do_plano || 'SEM PLANO';
  planningFields.numero_plano_emprego_operacional.value = record.numero_plano_emprego_operacional || '';
  planningFields.equipe_empenhada.value = record.equipe_empenhada || '';
  planningFields.prioridade_dsub.value = record.prioridade_dsub || '';
  planningFields.apoio_gcmbh.value = record.apoio_gcmbh || '';
  planningFields.informacoes.value = record.informacoes || '';
  planningFields.qtd_transito.value = record.qtd_transito || 0;
  planningFields.qtd_dme.value = record.qtd_dme || 0;
  planningFields.qtd_gtur.value = record.qtd_gtur || 0;
  planningFields.qtd_gepam.value = record.qtd_gepam || 0;
  planningFields.qtd_gpir.value = record.qtd_gpir || 0;
  planningFields.qtd_outros.value = record.qtd_outros || 0;
  planningFields.qtd_dma.value = record.qtd_dma || 0;
  planningFields.qtd_norte.value = record.qtd_norte || 0;
  planningFields.qtd_venda_nova.value = record.qtd_venda_nova || 0;
  planningFields.qtd_pampulha.value = record.qtd_pampulha || 0;
  planningFields.qtd_leste.value = record.qtd_leste || 0;
  planningFields.qtd_nordeste.value = record.qtd_nordeste || 0;
  planningFields.qtd_barreiro.value = record.qtd_barreiro || 0;
  planningFields.qtd_oeste.value = record.qtd_oeste || 0;
  planningFields.qtd_noroeste.value = record.qtd_noroeste || 0;
  planningFields.qtd_centro_sul.value = record.qtd_centro_sul || 0;
  planningFields.qtd_hipercentro.value = record.qtd_hipercentro || 0;

  el.planningModal.classList.remove('hidden');
  el.planningModal.setAttribute('aria-hidden', 'false');
}

function closePlanningModal() {
  el.planningModal.classList.add('hidden');
  el.planningModal.setAttribute('aria-hidden', 'true');
}

async function savePlanning(event) {
  event.preventDefault();

  const blocoId = el.modalBlockId.value;
  const payload = {
    bloco_consolidado_id: blocoId,
    situacao_do_plano: planningFields.situacao_do_plano.value || 'SEM PLANO',
    numero_plano_emprego_operacional: planningFields.numero_plano_emprego_operacional.value || null,
    equipe_empenhada: planningFields.equipe_empenhada.value || null,
    prioridade_dsub: planningFields.prioridade_dsub.value || null,
    apoio_gcmbh: planningFields.apoio_gcmbh.value || null,
    informacoes: planningFields.informacoes.value || null,
    qtd_transito: Number(planningFields.qtd_transito.value || 0),
    qtd_dme: Number(planningFields.qtd_dme.value || 0),
    qtd_gtur: Number(planningFields.qtd_gtur.value || 0),
    qtd_gepam: Number(planningFields.qtd_gepam.value || 0),
    qtd_gpir: Number(planningFields.qtd_gpir.value || 0),
    qtd_outros: Number(planningFields.qtd_outros.value || 0),
    qtd_dma: Number(planningFields.qtd_dma.value || 0),
    qtd_norte: Number(planningFields.qtd_norte.value || 0),
    qtd_venda_nova: Number(planningFields.qtd_venda_nova.value || 0),
    qtd_pampulha: Number(planningFields.qtd_pampulha.value || 0),
    qtd_leste: Number(planningFields.qtd_leste.value || 0),
    qtd_nordeste: Number(planningFields.qtd_nordeste.value || 0),
    qtd_barreiro: Number(planningFields.qtd_barreiro.value || 0),
    qtd_oeste: Number(planningFields.qtd_oeste.value || 0),
    qtd_noroeste: Number(planningFields.qtd_noroeste.value || 0),
    qtd_centro_sul: Number(planningFields.qtd_centro_sul.value || 0),
    qtd_hipercentro: Number(planningFields.qtd_hipercentro.value || 0),
    revisado_apos_ultima_alteracao: true,
    ultima_revisao_em: new Date().toISOString()
  };

  const { error } = await state.supabase
    .from('planejamento_operacional')
    .upsert(payload, { onConflict: 'bloco_consolidado_id' });

  if (error) {
    toast(`Erro ao salvar planejamento: ${error.message}`, true);
    return;
  }

  closePlanningModal();
  toast('Planejamento salvo com sucesso.');
  await loadData();
}

async function handleLogin(event) {
  event.preventDefault();
  const email = event.currentTarget.email.value.trim();
  const password = event.currentTarget.password.value;

  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    toast(`Erro no login: ${error.message}`, true);
  }
}

async function handleLogout() {
  await state.supabase.auth.signOut();
}

function updateSessionUI(session) {
  state.session = session;
  const logged = !!session;
  el.sessionBadge.textContent = logged ? `Conectado: ${session.user.email}` : '';
  el.sessionBadge.classList.toggle('hidden', !logged);
  el.logoutBtn.classList.toggle('hidden', !logged);
  el.refreshBtn.classList.toggle('hidden', false);
  el.loginSection.classList.toggle('hidden', logged || !CONFIG.requireLogin);
  el.dashboardSection.classList.toggle('hidden', !logged && CONFIG.requireLogin);

  if (!CONFIG.requireLogin && !logged) {
    el.dashboardSection.classList.remove('hidden');
    el.logoutBtn.classList.add('hidden');
    el.sessionBadge.classList.add('hidden');
  }
}


async function bootstrap() {
  if (!CONFIG.supabaseUrl || CONFIG.supabaseUrl.includes('COLE_AQUI')) {
    toast('Edite o arquivo js/config.js com a URL e a chave anon do Supabase.', true);
    return;
  }

  el.siteTitle.textContent = CONFIG.siteTitle;
  state.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    updateSessionUI(session);
    if (session || !CONFIG.requireLogin) {
      try {
        await loadData();
      } catch (error) {
        toast(`Erro ao carregar dados: ${error.message}`, true);
      }
    }
  });

  const { data: { session } } = await state.supabase.auth.getSession();
  updateSessionUI(session);

  if (session || !CONFIG.requireLogin) {
    try {
      await loadData();
    } catch (error) {
      toast(`Erro ao carregar dados: ${error.message}`, true);
    }
  }
}

el.loginForm.addEventListener('submit', handleLogin);
el.logoutBtn.addEventListener('click', handleLogout);
el.refreshBtn.addEventListener('click', async () => {
  try {
    await loadData();
    toast('Dados atualizados.');
  } catch (error) {
    toast(`Erro ao atualizar: ${error.message}`, true);
  }
});
el.navTabs.addEventListener('click', event => {
  const btn = event.target.closest('[data-tab]');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});
[el.searchInput, el.regionalFilter, el.statusFilter, el.dateFilter].forEach(input => {
  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);
});
el.blocosTableWrap.addEventListener('click', event => {
  const button = event.target.closest('[data-open-planning]');
  if (!button) return;
  openPlanningModal(button.dataset.openPlanning);
});
el.closeModalBtn.addEventListener('click', closePlanningModal);
el.cancelModalBtn.addEventListener('click', closePlanningModal);
el.planningModal.addEventListener('click', event => {
  if (event.target.dataset.closeModal === 'true') closePlanningModal();
});
el.planningForm.addEventListener('submit', savePlanning);

bootstrap();
