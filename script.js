const naoEQuitacao = m => m.classificacao !== 'quitacao_divida';

// ── Ocultar/mostrar saldo ────────────────────────────────────────
let _saldoOculto = localStorage.getItem('monvy_ocultar_saldo') === '1';

// IDs dos elementos que devem ser mascarados
const _saldoIds = [
  'saldo-display','kpi-entradas','kpi-saidas','kpi-movs',
  'kpi-falta-pagar','kpi-saldo-disponivel',
  'saldo-mes','kpi-entradas-sub','kpi-saidas-sub'
];

function aplicarMascaraSaldo() {
  const ocultar = _saldoOculto;
  const mask = '••••••';

  _saldoIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (ocultar) {
      if (!el.dataset.valorReal) el.dataset.valorReal = el.textContent;
      el.textContent = mask;
      el.style.filter = 'blur(0)';
      el.style.userSelect = 'none';
    } else {
      if (el.dataset.valorReal) {
        el.textContent = el.dataset.valorReal;
        delete el.dataset.valorReal;
      }
      el.style.filter = '';
      el.style.userSelect = '';
    }
  });

  // Atualizar ícone do olho
  const show = document.getElementById('icon-eye-show');
  const hide = document.getElementById('icon-eye-hide');
  if (show) show.style.display = ocultar ? 'none' : 'block';
  if (hide) hide.style.display = ocultar ? 'block' : 'none';
}

window.toggleOcultarSaldo = function() {
  _saldoOculto = !_saldoOculto;
  localStorage.setItem('monvy_ocultar_saldo', _saldoOculto ? '1' : '0');
  aplicarMascaraSaldo();
};

// Aplicar máscara após KPIs atualizarem
const _origAtualizarKPIs = atualizarKPIs;

// ── Sidebar mobile ────────────────────────────────────────────────
// ── Configurações completas ───────────────────────────────────────

// ── Dashboard Premium — Atualizar cards ──────────────────────────
function atualizarDashboardPremium() {
  const hoje = new Date();
  const anoMes = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  const movMes = movimentacoes.filter(m=>m.data&&m.data.startsWith(anoMes));
  const entMes = movMes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const saiMes = movMes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const saldoTotal = movimentacoes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0)
                   - movimentacoes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);

  // Card Saldo
  const sd = document.getElementById('saldo-display');
  if(sd) { sd.textContent = fmtSaldo(saldoTotal); sd.style.color = saldoTotal<0?'#ef4444':''; }
  const sm = document.getElementById('saldo-mes');
  if(sm) sm.textContent = `+${fmt(entMes)} entrou este mês`;

  // Entradas/Saídas
  const ke = document.getElementById('kpi-entradas'); if(ke) ke.textContent=fmt(entMes);
  const ks = document.getElementById('kpi-saidas');   if(ks) ks.textContent=fmt(saiMes);

  // Falta pagar
  const contasPend = contas.filter(c=>!c.paga&&c.tipo==='pagar');
  const totalPend = contasPend.reduce((s,c)=>s+(c.valor||0),0);
  const kfp = document.getElementById('kpi-falta-pagar');
  if(kfp){kfp.textContent=fmt(totalPend);kfp.style.color=totalPend>0?'#ef4444':'#22c55e';}

  // Card Score
  const scoreEl = document.getElementById('kpi-score-mini');
  const scoreLbl = document.getElementById('kpi-score-mini-label');
  const scoreBar = document.getElementById('db-score-bar');
  // Score já calculado pelo calcularScore() — pegar valor do DOM
  const scoreVal = parseInt(scoreEl?.textContent)||0;
  if(scoreBar) scoreBar.style.width = Math.min(scoreVal/10, 100)+'%';

  // Card Contas Pendentes
  renderCardContas(contasPend, totalPend, hoje);

  // Card Meta
  renderCardMeta();

  // Card Previsão
  renderCardPrevisao(saiMes, saldoTotal, hoje);

  // Fluxo resultado
  const res = entMes - saiMes;
  const dbFluxo = document.getElementById('db-fluxo-resultado');
  if(dbFluxo) {
    dbFluxo.textContent = (res>=0?'+':'')+fmt(res);
    dbFluxo.style.color = res>=0?'var(--primary)':'#ef4444';
  }

  // KPIs ocultos para compatibilidade
  const km = document.getElementById('kpi-movs'); if(km) km.textContent=movimentacoes.length;
  const ksd = document.getElementById('kpi-saldo-disponivel');
  if(ksd) ksd.textContent=fmtSaldo(saldoTotal-totalPend);
}

function renderCardContas(pendentes, total, hoje) {
  const el = document.getElementById('db-contas-content');
  if(!el) return;
  const hojeStr = hoje.toISOString().slice(0,10);
  const proxSemana = new Date(hoje); proxSemana.setDate(proxSemana.getDate()+7);
  const proxStr = proxSemana.toISOString().slice(0,10);
  const proxSemanaContas = pendentes.filter(c=>c.vencimento&&c.vencimento<=proxStr);

  if(pendentes.length===0){
    el.innerHTML=`<div class="db-contas-ok">
      <div class="db-contas-ok-icon">🎉</div>
      <div class="db-contas-ok-txt">Tudo em dia!</div>
      <div class="db-contas-ok-sub">Nenhuma conta pendente</div>
    </div>`;
  } else {
    el.innerHTML=`<div class="db-contas-alerta">
      <div class="db-contas-valor">${fmt(total)}</div>
      <div class="db-contas-desc">${pendentes.length} conta(s) pendente(s)</div>
      ${proxSemanaContas.slice(0,2).map(c=>`<div class="db-contas-item">
        <span>${c.descricao||'Conta'}</span>
        <span style="color:#ef4444;font-weight:700">${fmt(c.valor)}</span>
      </div>`).join('')}
      ${proxSemanaContas.length>2?`<div style="font-size:.7rem;color:var(--gray);text-align:center">+${proxSemanaContas.length-2} mais esta semana</div>`:''}
    </div>`;
  }
}

function renderCardMeta() {
  const el = document.getElementById('db-meta-content');
  if(!el) return;
  const ativas = metas.filter(m=>(m.atual||0)<(m.valor||1));
  if(!ativas.length){
    el.innerHTML=`<div class="db-meta-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:28px;opacity:.3"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      <span style="font-size:.75rem;color:var(--gray)">Criar meta</span>
    </div>`;
    return;
  }
  const m = ativas.sort((a,b)=>((b.atual||0)/b.valor)-((a.atual||0)/a.valor))[0];
  const pct = Math.min(Math.round(((m.atual||0)/m.valor)*100),100);
  el.innerHTML=`<div>
    <div class="db-meta-nome">${m.nome}</div>
    <div class="db-meta-valores"><span>${fmt(m.atual||0)}</span><span>${fmt(m.valor)}</span></div>
    <div class="db-meta-bar-wrap"><div class="db-meta-bar" style="width:${pct}%"></div></div>
    <div class="db-meta-pct">${pct}% concluído</div>
  </div>`;
}

function renderCardPrevisao(saiMes, saldo, hoje) {
  const el = document.getElementById('db-previsao-texto');
  const elVal = document.getElementById('db-previsao-valor');
  if(!el) return;
  const diasMes = new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate();
  const diasPassados = hoje.getDate();
  const diasRestantes = diasMes - diasPassados;
  if(diasPassados===0||saiMes===0){el.textContent='Adicione movimentações para ver a previsão.';return;}
  const gastoDiario = saiMes/diasPassados;
  const projecaoGasto = saiMes + gastoDiario*diasRestantes;
  const saldoFinal = saldo - gastoDiario*diasRestantes;
  if(saldoFinal>0){
    el.textContent=`Se continuar assim, terminará o mês no positivo.`;
    if(elVal){elVal.textContent=`+${fmt(saldoFinal)} estimado`;elVal.style.color='#22c55e';}
  } else {
    el.textContent=`Atenção: seu ritmo de gastos pode comprometer o saldo.`;
    if(elVal){elVal.textContent=`${fmt(saldoFinal)} estimado`;elVal.style.color='#ef4444';}
  }
}

// ══ Dashboard Premium ════════════════════════════════════════════

function renderDashboardPremium() {
  renderDbSaldo();
  renderDbContas();
  renderDbScore();
  renderDbMeta();
  renderDbInsight();
  gerarInsightsMavenWidget();
}

// Card Contas — Controle
function renderDbContas() {
  const contasPend = contas.filter(c=>!c.paga&&c.tipo==='pagar');
  const iconEl = document.getElementById('db-contas-icon');
  const txtEl  = document.getElementById('db-contas-txt');
  const subEl  = document.getElementById('db-contas-sub');
  if (!txtEl) return;
  if (contasPend.length === 0) {
    if (iconEl) iconEl.textContent = '🎉';
    txtEl.textContent = 'Tudo em dia!'; txtEl.style.color = 'var(--primary)';
    if (subEl) subEl.textContent = 'Nenhuma conta pendente';
  } else {
    const total = contasPend.reduce((s,c)=>s+(c.valor||0),0);
    // Verificar vencimentos próximos
    const hoje = new Date().toISOString().slice(0,10);
    const semana = new Date(); semana.setDate(semana.getDate()+7);
    const proximas = contasPend.filter(c=>c.vencimento&&c.vencimento<=semana.toISOString().slice(0,10));
    if (iconEl) iconEl.textContent = proximas.length > 0 ? '⚠️' : '📅';
    txtEl.textContent = fmt(total); txtEl.style.color = '#ef4444';
    if (subEl) subEl.textContent = proximas.length > 0
      ? proximas.length + ' vencem esta semana'
      : contasPend.length + ' conta(s) pendente(s)';
  }
}

// Card Insight — Descoberta
function renderDbInsight() {
  const el = document.getElementById('db-insight-content');
  if (!el) return;
  const hoje = new Date();
  const anoMes = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  const movMes = movimentacoes.filter(m=>m.data&&m.data.startsWith(anoMes));
  const sai = movMes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const ent = movMes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  // Top categoria
  const cats = {};
  movMes.filter(m=>m.tipo==='gasto').forEach(m=>{cats[m.categoria||'Outros']=(cats[m.categoria||'Outros']||0)+(m.valor||0);});
  const topCat = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  // Mês anterior
  const mesAnt = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1);
  const anoMesAnt = mesAnt.getFullYear()+'-'+String(mesAnt.getMonth()+1).padStart(2,'0');
  const saiAnt = movimentacoes.filter(m=>m.data&&m.data.startsWith(anoMesAnt)&&m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);

  let insight = { icon:'💡', texto:'', destaque:'' };

  if (sai === 0) {
    insight = { icon:'📊', texto:'Adicione gastos para ver descobertas financeiras', destaque:'' };
  } else if (topCat && (topCat[1]/sai) > 0.4) {
    const pct = Math.round(topCat[1]/sai*100);
    insight = { icon:'🔍', texto:`${topCat[0]} concentra`, destaque:`${pct}% dos seus gastos` };
  } else if (saiAnt > 0 && sai < saiAnt * 0.9) {
    insight = { icon:'🎯', texto:'Você gastou menos que o mês passado', destaque:`-${fmt(saiAnt-sai)} economizados` };
  } else if (saiAnt > 0 && sai > saiAnt * 1.1) {
    const pct = Math.round((sai-saiAnt)/saiAnt*100);
    insight = { icon:'📈', texto:'Gastos acima do mês passado', destaque:`+${pct}% a mais` };
  } else if (ent > 0 && sai/ent < 0.5) {
    insight = { icon:'💚', texto:'Você está guardando mais da metade da sua renda', destaque:`${Math.round((1-sai/ent)*100)}% de economia` };
  } else {
    insight = { icon:'✨', texto:'Suas finanças estão equilibradas este mês', destaque:`${fmt(ent-sai)} de saldo` };
  }

  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-top:4px">
      <span style="font-size:1.6rem;flex-shrink:0">${insight.icon}</span>
      <div>
        <div style="font-size:.82rem;color:var(--gray);line-height:1.4">${insight.texto}</div>
        ${insight.destaque ? `<div style="font-size:1rem;font-weight:800;color:var(--primary);margin-top:4px">${insight.destaque}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:10px;font-size:.7rem;color:var(--gray)">Ver relatório completo →</div>`;
}

// Card Saldo — já atualizado pelo atualizarKPIs
function renderDbSaldo() {
  // saldo-display, saldo-mes, kpi-entradas, kpi-saidas, kpi-falta-pagar
  // já são atualizados pelo atualizarKPIs() existente
}

// Card Fluxo — resultado
function renderDbFluxo() {
  const hoje = new Date();
  const anoMes = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  const movMes = movimentacoes.filter(m=>m.data&&m.data.startsWith(anoMes));
  const ent = movMes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const sai = movMes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const saldo = ent - sai;
  // Atualizar entradas e saídas do card fluxo resumido
  const elEnt = document.getElementById('db-ent-fluxo');
  const elSai = document.getElementById('db-sai-fluxo');
  const elRes = document.getElementById('db-fluxo-resultado');
  if (elEnt) elEnt.textContent = fmt(ent);
  if (elSai) elSai.textContent = fmt(sai);
  if (elRes) { elRes.textContent = (saldo>=0?'+':'')+fmt(saldo); elRes.style.color = saldo>=0?'var(--primary)':'#ef4444'; }
  // Atualizar contas pendentes
  const contasPend = contas.filter(c=>!c.paga&&c.tipo==='pagar');
  const iconEl = document.getElementById('db-contas-icon');
  const txtEl  = document.getElementById('db-contas-txt');
  const subEl  = document.getElementById('db-contas-sub');
  if (contasPend.length === 0) {
    if (iconEl) iconEl.textContent = '🎉';
    if (txtEl)  txtEl.textContent = 'Tudo em dia!'; if (txtEl) txtEl.style.color = 'var(--primary)';
    if (subEl)  subEl.textContent = 'Nenhuma conta pendente';
  } else {
    const total = contasPend.reduce((s,c)=>s+(c.valor||0),0);
    if (iconEl) iconEl.textContent = '📅';
    if (txtEl)  { txtEl.textContent = fmt(total); txtEl.style.color = '#ef4444'; }
    if (subEl)  subEl.textContent = contasPend.length + ' conta(s) pendente(s)';
  }
}

// Card Score
function renderDbScore() {
  // kpi-score-mini e kpi-score-mini-label já atualizados por calcularScore()
  // Atualizar barra de progresso
  const scoreEl = document.getElementById('kpi-score-mini');
  const barEl   = document.getElementById('db-score-bar');
  if (!scoreEl || !barEl) return;
  const score = parseInt(scoreEl.textContent) || 0;
  setTimeout(() => { barEl.style.width = Math.min(score/10, 100) + '%'; }, 200);
}

// Card Meta
function renderDbMeta() {
  const el = document.getElementById('db-meta-content');
  if (!el) return;
  if (!metas || metas.length === 0) {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px 0;text-align:center">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--primary-dim);border:1.5px solid rgba(34,197,94,0.3);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        </div>
        <div style="font-size:.8rem;font-weight:600;color:var(--white)">Sem metas ativas</div>
        <div style="font-size:.72rem;color:var(--gray)">Defina um objetivo financeiro</div>
        <button onclick="(window.irPara||irPara)('metas')" style="margin-top:2px;padding:5px 14px;border-radius:8px;border:1px solid rgba(34,197,94,0.3);background:var(--primary-dim);color:var(--primary);font-size:.72rem;font-weight:700;font-family:inherit;cursor:pointer">+ Criar meta</button>
      </div>`;
    return;
  }
  const meta = [...metas].filter(m=>(parseFloat(m.valor)||0)>0).sort((a,b)=>((parseFloat(b.atual)||0)/parseFloat(b.valor)) - ((parseFloat(a.atual)||0)/parseFloat(a.valor)))[0];
  if (!meta) return;
  const atual = parseFloat(meta.atual)||0;
  const valor = parseFloat(meta.valor)||1;
  const pct = Math.min(Math.round((atual/valor)*100), 100);
  el.innerHTML = `
    <div class="db-meta-nome">${meta.nome||'Meta'}</div>
    <div class="db-meta-vals">${fmt(atual)} / ${fmt(valor)}</div>
    <div class="db-meta-bar-wrap"><div class="db-meta-bar" style="width:${pct}%"></div></div>
    <div class="db-meta-pct">${pct}% concluído</div>`;
}

// Card Previsão
function renderDbPrevisao() {
  const textoEl = document.getElementById('db-previsao-texto');
  const valorEl = document.getElementById('db-previsao-valor');
  const iconEl  = document.querySelector('.db-previsao-icon');
  if (!textoEl) return;

  const hoje = new Date();
  const anoMes = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  const movMes = movimentacoes.filter(m=>m.data&&m.data.startsWith(anoMes));
  const sai = movMes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const ent = movMes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const totalEnt = movimentacoes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const totalSai = movimentacoes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const saldoAtual = totalEnt - totalSai;

  const diasMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const diasRestantes = diasMes - hoje.getDate();
  const gastoDiario = hoje.getDate() > 0 ? sai / hoje.getDate() : 0;
  const projecaoGasto = gastoDiario * diasRestantes;
  const saldoFim = saldoAtual - projecaoGasto;
  const contasPend = contas.filter(c=>!c.paga&&c.tipo==='pagar').reduce((s,c)=>s+(c.valor||0),0);
  const disponivelReal = saldoFim - contasPend;

  if (sai === 0) {
    if (iconEl) iconEl.textContent = '💡';
    textoEl.textContent = 'Comece a registrar seus gastos para ver a previsão';
    if (valorEl) valorEl.textContent = '';
    return;
  }

  if (disponivelReal >= 0) {
    if (iconEl) iconEl.textContent = '✅';
    textoEl.textContent = 'Você terminará o mês no positivo';
    if (valorEl) { valorEl.textContent = fmt(disponivelReal) + ' disponível'; valorEl.style.color = 'var(--primary)'; }
  } else {
    if (iconEl) iconEl.textContent = '⚠️';
    textoEl.textContent = 'Atenção: projeção de saldo negativo';
    if (valorEl) { valorEl.textContent = fmt(disponivelReal); valorEl.style.color = '#ef4444'; }
  }
}

// ── Maven Widget — Insights automáticos no Dashboard ────────────
function gerarInsightsMavenWidget() {
  const el = document.getElementById('klaus-widget-insights');
  if (!el) return;

  const hoje = new Date();
  const anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');
  const movMes = movimentacoes.filter(m => m.data && m.data.startsWith(anoMes));
  const entMes = movMes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const saiMes = movMes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const saldo  = movimentacoes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0)
                - movimentacoes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);

  // Mês anterior
  const mesAnt = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1);
  const anoMesAnt = mesAnt.getFullYear() + '-' + String(mesAnt.getMonth()+1).padStart(2,'0');
  const movAnt = movimentacoes.filter(m=>m.data&&m.data.startsWith(anoMesAnt));
  const saiAnt = movAnt.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);

  // Top categoria
  const cats = {};
  movMes.filter(m=>m.tipo==='gasto').forEach(m=>{ cats[m.categoria||'Outros']=(cats[m.categoria||'Outros']||0)+(m.valor||0); });
  const topCat = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  const pctTopCat = saiMes>0&&topCat ? Math.round(topCat[1]/saiMes*100) : 0;

  // Dias restantes no mês
  const diasMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const diasPassados = hoje.getDate();
  const diasRestantes = diasMes - diasPassados;

  // Gasto diário médio e projeção
  const gastoDiario = diasPassados > 0 ? saiMes / diasPassados : 0;
  const projecao = saiMes + gastoDiario * diasRestantes;

  // Contas pendentes
  const contasPend = contas.filter(c=>!c.paga&&c.tipo==='pagar');
  const totalPend = contasPend.reduce((s,c)=>s+(c.valor||0),0);

  // Metas
  const metasAtivas = metas.filter(m=>(m.valor||0)>0 && (m.atual||0)<m.valor);
  const metaProxima = [...metasAtivas].sort((a,b)=>((b.atual||0)/b.valor)-((a.atual||0)/a.valor))[0];

  // Gerar insights
  const insights = [];

  // 1. Comparativo com mês anterior
  if (saiAnt > 0 && saiMes > 0) {
    const diff = ((saiMes - saiAnt) / saiAnt * 100);
    if (diff > 10) {
      insights.push({ icon:'📈', tag:'alerta', text:`Gastos ${Math.abs(diff).toFixed(0)}% maiores que o mês passado` });
    } else if (diff < -10) {
      insights.push({ icon:'🎉', tag:'dica', text:`Você economizou ${fmt(saiAnt-saiMes)} comparado ao mês passado` });
    }
  }

  // 2. Top categoria
  if (topCat && pctTopCat > 30) {
    insights.push({ icon:'💡', tag:'info', text:`${topCat[0]} representa ${pctTopCat}% dos seus gastos este mês` });
  }

  // 3. Projeção de saldo
  if (gastoDiario > 0 && saldo > 0) {
    const diasSaldo = Math.floor(saldo / gastoDiario);
    if (diasSaldo < 15) {
      insights.push({ icon:'⚠️', tag:'alerta', text:`Seu saldo pode durar ~${diasSaldo} dias no ritmo atual` });
    } else {
      insights.push({ icon:'✅', tag:'dica', text:`Seu saldo cobre os próximos ${diasSaldo} dias de gastos` });
    }
  }

  // 4. Contas pendentes
  if (totalPend > 0) {
    insights.push({ icon:'📅', tag:'alerta', text:`${contasPend.length} conta(s) pendente(s) — total de ${fmt(totalPend)}` });
  }

  // 5. Meta mais próxima
  if (metaProxima) {
    const pct = metaProxima.valor > 0 ? Math.round(((metaProxima.atual||0) / metaProxima.valor) * 100) : 0;
    insights.push({ icon:'🎯', tag:'meta', text:`Meta "${metaProxima.nome}" — ${pct}% concluída` });
  }

  // 6. Saldo do mês
  if (entMes > 0) {
    const sobra = entMes - saiMes;
    if (sobra > 0) {
      insights.push({ icon:'💰', tag:'dica', text:`Você guardou ${fmt(sobra)} este mês` });
    }
  }

  // Fallback
  if (insights.length === 0) {
    insights.push({ icon:'📊', tag:'info', text:'Adicione movimentações para ver seus insights financeiros' });
    insights.push({ icon:'💡', tag:'dica', text:'Registre seus gastos diários para análises precisas' });
  }

  // Renderizar no novo formato premium
  const dest = document.getElementById('db-klaus-insight') || document.getElementById('klaus-widget-insights');
  if (!dest) { el.innerHTML = insights.slice(0,5).map(i=>`<div class="klaus-insight-item"><div class="klaus-insight-icon">${i.icon}</div><div class="klaus-insight-text">${i.text}</div></div>`).join(''); return; }

  dest.innerHTML = insights.slice(0,3).map(i => `
    <div class="db-insight-bubble" onclick="(window.irPara||irPara)('klaus')">
      <span class="db-insight-emoji">${i.icon}</span>
      <span class="db-insight-text">${i.text}</span>
      <span class="db-insight-tag-pill" style="background:${
        i.tag==='alerta'?'rgba(239,68,68,0.12)':i.tag==='dica'?'rgba(34,197,94,0.12)':
        i.tag==='meta'?'rgba(139,92,246,0.12)':'rgba(245,158,11,0.12)'};color:${
        i.tag==='alerta'?'#ef4444':i.tag==='dica'?'#22c55e':
        i.tag==='meta'?'#a78bfa':'#f59e0b'}">${
        i.tag==='alerta'?'Alerta':i.tag==='dica'?'Dica':i.tag==='meta'?'Meta':'Info'}</span>
    </div>`).join('');
  if (el !== dest) el.innerHTML = dest.innerHTML;
}

// ── Maven — Assistente Financeiro IA ────────────────────────────
let klausHistorico = [];

function klausContexto() {
  const hoje = new Date();
  const anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const diaAtual = hoje.getDate();
  const pctMes = Math.round((diaAtual / diasNoMes) * 100);

  // Mês atual
  const movMes = movimentacoes.filter(m => m.data?.startsWith(anoMes));
  const ent = movMes.filter(m => m.tipo==='ganho').reduce((s,m) => s+(m.valor||0), 0);
  const sai = movMes.filter(m => m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m) => s+(m.valor||0), 0);

  // Total histórico
  const totalEnt = movimentacoes.filter(m => m.tipo==='ganho').reduce((s,m) => s+(m.valor||0), 0);
  const totalSai = movimentacoes.filter(m => m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m) => s+(m.valor||0), 0);

  // Histórico dos últimos 3 meses
  const hist = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
    const mes = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const nomeMes = d.toLocaleDateString('pt-BR', {month:'long'});
    const ms = movimentacoes.filter(m => m.data?.startsWith(mes));
    const me = ms.filter(m => m.tipo==='ganho').reduce((s,m) => s+(m.valor||0), 0);
    const ms2 = ms.filter(m => m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m) => s+(m.valor||0), 0);
    if (me>0||ms2>0) hist.push(`${nomeMes}: entradas R$${me.toFixed(0)}, saídas R$${ms2.toFixed(0)}, saldo R$${(me-ms2).toFixed(0)}`);
  }

  // Categorias de gasto do mês
  const catGastos = {};
  movMes.filter(m => m.tipo==='gasto'&&naoEQuitacao(m)).forEach(m => {
    catGastos[m.categoria||'Outros'] = (catGastos[m.categoria||'Outros']||0)+(m.valor||0);
  });
  const topCat = Object.entries(catGastos).sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([c,v])=>`${c}: R$${v.toFixed(2)}`).join(' | ');

  // Categorias de entrada do mês
  const catEnt = {};
  movMes.filter(m => m.tipo==='ganho').forEach(m => {
    catEnt[m.categoria||'Renda'] = (catEnt[m.categoria||'Renda']||0)+(m.valor||0);
  });
  const topEntStr = Object.entries(catEnt).sort((a,b)=>b[1]-a[1]).slice(0,3)
    .map(([c,v])=>`${c}: R$${v.toFixed(2)}`).join(' | ');

  // Recorrentes
  const recGastos = movimentacoes.filter(m => m.recorrente&&m.tipo==='gasto');
  const recEnt = movimentacoes.filter(m => m.recorrente&&m.tipo==='ganho');

  // Score
  const score = calcularScoreValor();
  const scoreCls = score>=800?'Excelente':score>=600?'Bom':score>=400?'Estável':score>=200?'Atenção':'Crítico';

  // Perfil e renda
  const vida = perfilUsuario?.perfilVida || {};
  const renda = perfilUsuario?.renda || vida.renda || 0;
  const txPoupanca = ent>0 ? Math.round(((ent-sai)/ent)*100) : null;

  // Metas detalhadas
  const metasDet = metas.map(m => {
    const pct = m.valor>0 ? Math.round(((m.atual||0)/m.valor)*100) : 0;
    return `"${m.nome||'Meta'}": R$${(m.atual||0).toFixed(0)}/R$${(m.valor||0).toFixed(0)} (${pct}%)`;
  });

  // Dívidas detalhadas
  const divAtivas = dividas.filter(d => d.status!=='quitada');
  const divDet = divAtivas.map(d => {
    const juros = d.taxa ? ` | juros ${d.taxa}%a.m.` : '';
    return `"${d.descricao||d.tipo||'Dívida'}": R$${(d.valor||0).toFixed(2)}${juros}`;
  });

  // Contas a pagar detalhadas
  const hoje_str = hoje.toISOString().split('T')[0];
  const contasPend = contas.filter(c => !c.paga&&c.tipo==='pagar');
  const contasVenc = contasPend.filter(c => c.vencimento&&c.vencimento<hoje_str);
  const contasDet = contasPend.slice(0,8).map(c => {
    const vencida = c.vencimento&&c.vencimento<hoje_str ? ' ⚠️VENCIDA' : '';
    return `"${c.descricao||'Conta'}": R$${(c.valor||0).toFixed(2)} venc.${c.vencimento||'?'}${vencida}`;
  });

  // Contas a receber
  const contasReceber = contas.filter(c => !c.paga&&c.tipo==='receber');

  // Últimas 5 movimentações
  const ultMovs = [...movimentacoes]
    .sort((a,b) => (b.data||'').localeCompare(a.data||''))
    .slice(0,5)
    .map(m => `${m.data||'?'} ${m.tipo==='ganho'?'+':'-'}R$${(m.valor||0).toFixed(2)} [${m.categoria||'?'}] ${m.descricao||''}`);

  let ctx = `=== DADOS FINANCEIROS — ${hoje.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} ===
Mês ${pctMes}% decorrido (dia ${diaAtual} de ${diasNoMes})

💰 SITUAÇÃO GERAL
Saldo total acumulado: R$${(totalEnt-totalSai).toFixed(2)}
Score financeiro: ${score} pts — ${scoreCls}${renda>0?'\nRenda mensal (perfil): R$'+renda.toFixed(2):''}${txPoupanca!==null?'\nTaxa de poupança este mês: '+txPoupanca+'%':''}

📅 MÊS ATUAL
Entradas: R$${ent.toFixed(2)}${topEntStr?' ('+topEntStr+')':''}
Saídas: R$${sai.toFixed(2)}
Saldo do mês: R$${(ent-sai).toFixed(2)}
Movimentações registradas: ${movMes.length}
Gastos por categoria: ${topCat||'nenhum'}`;

  if (hist.length>0) ctx += `\n\n📊 HISTÓRICO RECENTE\n${hist.join('\n')}`;

  if (recGastos.length>0||recEnt.length>0) {
    ctx += `\n\n🔄 RECORRENTES`;
    if (recGastos.length>0) {
      ctx += `\nGastos fixos: ${recGastos.length} — R$${recGastos.reduce((s,m)=>s+(m.valor||0),0).toFixed(2)}/mês`;
      ctx += '\n  '+recGastos.slice(0,6).map(m=>`${m.descricao||m.categoria}: R$${(m.valor||0).toFixed(2)}`).join(' | ');
    }
    if (recEnt.length>0) ctx += `\nEntradas fixas: ${recEnt.length} — R$${recEnt.reduce((s,m)=>s+(m.valor||0),0).toFixed(2)}/mês`;
  }

  if (divAtivas.length>0) ctx += `\n\n💳 DÍVIDAS ATIVAS (${divAtivas.length}) — Total: R$${divAtivas.reduce((s,d)=>s+(d.valor||0),0).toFixed(2)}\n${divDet.join('\n')}`;

  if (contasPend.length>0) {
    ctx += `\n\n📋 CONTAS A PAGAR (${contasPend.length}) — Total: R$${contasPend.reduce((s,c)=>s+(c.valor||0),0).toFixed(2)}`;
    if (contasVenc.length>0) ctx += `\n⚠️ Vencidas: ${contasVenc.length} (R$${contasVenc.reduce((s,c)=>s+(c.valor||0),0).toFixed(2)})`;
    ctx += '\n'+contasDet.join('\n');
  }

  if (contasReceber.length>0) ctx += `\n\n💵 A RECEBER: ${contasReceber.length} conta(s) — R$${contasReceber.reduce((s,c)=>s+(c.valor||0),0).toFixed(2)}`;

  if (metas.length>0) ctx += `\n\n🎯 METAS (${metas.length})\n${metasDet.join('\n')}`;

  if (ultMovs.length>0) ctx += `\n\n🕒 ÚLTIMAS MOVIMENTAÇÕES\n${ultMovs.join('\n')}`;

  // Perfil de vida
  const perfilLinhas = [];
  if (vida.moradia) perfilLinhas.push(`Moradia: ${vida.moradia}`);
  if (vida.transporte?.length) perfilLinhas.push(`Transporte: ${vida.transporte.join(', ')}`);
  if (vida.filhos) perfilLinhas.push(`Filhos/dependentes: ${vida.filhos}`);
  if (vida.rotina?.length) perfilLinhas.push(`Assinaturas/rotina: ${vida.rotina.join(', ')}`);
  if (vida.dividas) {
    const ds = Object.entries(vida.dividas).filter(([,v])=>Number(v)>0).map(([k,v])=>`${k}: R$${v}`).join(', ');
    if (ds) perfilLinhas.push(`Dívidas declaradas no perfil: ${ds}`);
  }
  if (perfilLinhas.length>0) ctx += `\n\n👤 PERFIL DE VIDA\n${perfilLinhas.join('\n')}`;

  return ctx;
}

// ── Cache de respostas do Maven ──────────────────────────────────
const _klausCache = new Map();

function klausCacheKey(pergunta) {
  // Normalizar pergunta para cache (minúsculas, sem acentos, sem pontuação extra)
  return pergunta.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9 ]/g,'')
    .trim()
    .split(' ').slice(0,8).join(' '); // primeiras 8 palavras
}

function klausCacheBuscar(pergunta) {
  const key = klausCacheKey(pergunta);
  const cached = _klausCache.get(key);
  if (!cached) return null;
  // Cache válido por 30 minutos
  if (Date.now() - cached.ts > 30 * 60 * 1000) {
    _klausCache.delete(key);
    return null;
  }
  return cached.resposta;
}

function klausCacheSalvar(pergunta, resposta) {
  const key = klausCacheKey(pergunta);
  _klausCache.set(key, { resposta, ts: Date.now() });
  // Limitar cache a 50 entradas
  if (_klausCache.size > 50) {
    const primeiraChave = _klausCache.keys().next().value;
    _klausCache.delete(primeiraChave);
  }
}

async function klausChamarIA(pergunta, modoEmpresa, onChunk) {
  const nomeUsuario = (window._firebaseExports?.auth?.currentUser?.displayName||'').split(' ')[0] || '';
  const primeiro = nomeUsuario ? 'O nome do usuário é ' + nomeUsuario + '. ' : '';

    // Contexto dinâmico das fases 1-6
  const txList = window._transacoesCache || [];
  const saldoAtual = window._saldoAtual || 0;
  const metasList = window._metasCache || [];

  const sistemaPersonal = `Você é Maven, a inteligência central do Monvay — especialista financeiro com profundo conhecimento. O Monvay é um sistema operacional financeiro inteligente para administrar, entender e otimizar finanças pessoais e empresariais. Você é uma inteligência financeira avançada, não um chatbot. Comunique-se com sofisticação, clareza e confiança. Use linguagem humana, nunca jargão técnico. Saudação oficial: Olá, sou o Maven — seu assistente financeiro no Monvay. Sua missão: ser a camada de inteligência por trás de toda a vida financeira do usuário. REGRA ABSOLUTA: nunca exiba erros técnicos, nunca julgue decisões financeiras, nunca substitua contador em decisões tributárias. Máximo 3 linhas por resposta direta — aprofunde apenas se solicitado. — inteligente, estratégico e humano.
${primeiro}
PERSONALIDADE: Fale como um amigo especialista em finanças. Direto, prático e encorajador. Nunca julgue os gastos do usuário. Use linguagem simples mas precisa.

CAPACIDADES:
• Analise tendências entre meses e identifique padrões de comportamento financeiro
• Calcule projeções e simule cenários ("se economizar R$X por mês, alcança a meta em Y meses")
• Identifique as categorias de maior gasto e sugira cortes realistas
• Alerte sobre dívidas, contas vencidas e metas em risco
• Sugira estratégias de quitação de dívidas (bola de neve vs avalanche)
• Compare o desempenho do mês atual com meses anteriores

FORMATO DAS RESPOSTAS:
• Use **negrito** para valores, percentuais e pontos-chave
• Use listas com • para sugestões práticas e priorizadas
• Use ⚠️ apenas para alertas reais e urgentes
• Mostre cálculos quando ajudar a entender melhor
• Máximo 450 palavras — seja denso, não prolixo

REGRAS ABSOLUTAS:
• NUNCA invente dados, valores ou datas
• Se não tiver a informação, diga "não tenho esse dado disponível"
• Baseie TODO conselho nos dados financeiros reais fornecidos
• Não sugira ferramentas externas — o Monvay já tem o necessário
• Não repita os dados brutos sem análise — sempre acrescente interpretação e diagnóstico`;

  const sistemaEmpresa = `Você é Maven, o consultor financeiro empresarial do Monvay — estratégico, preciso e orientado a resultado.
${primeiro}
PERSONALIDADE: CFO virtual. Tom profissional e direto. Foco em crescimento, margem e saúde financeira do negócio.

CAPACIDADES:
• Diagnosticar saúde financeira: margem, fluxo de caixa, lucratividade
• Identificar gargalos e custos que comprimem a margem
• Comparar meses e detectar tendências de receita e custo
• Simular impacto de aumentos de preço ou corte de custos
• Alertar sobre inadimplência, contas vencidas e riscos de caixa
• Sugerir ações concretas para melhorar DRE e fluxo de caixa

FORMATO DAS RESPOSTAS:
• Use **negrito** para indicadores-chave (margem, faturamento, lucro)
• Use listas priorizadas para recomendações de ação
• Use ⚠️ para riscos financeiros reais e urgentes
• Mostre cálculos de impacto quando relevante
• Máximo 450 palavras — seja denso e direto

REGRAS ABSOLUTAS:
• NUNCA invente dados ou projete sem base nos números fornecidos
• Se dados insuficientes, diga explicitamente o que falta
• Baseie TODO conselho nos dados reais do negócio
• Priorize ações de maior impacto financeiro imediato`;

  const sistema = modoEmpresa ? sistemaEmpresa : sistemaPersonal;
  const ctx = klausContexto();
  const historico = klausHistorico.slice(-8);
  const perguntaComCtx = 'Dados financeiros:\n' + ctx + '\n\nPergunta: ' + pergunta;

  if (onChunk) {
    return await klausChamarCloudStream(perguntaComCtx, historico, sistema, onChunk);
  }
  return await klausChamarCloud(perguntaComCtx, historico, sistema);
}


function klausMensagem(texto, tipo) {
  const el = document.getElementById('klaus-mensagens');
  if (!el) return;
  const div = document.createElement('div');
  div.style.cssText = tipo==='user'
    ? 'display:flex;justify-content:flex-end'
    : 'display:flex;gap:10px;align-items:flex-start';

  if (tipo==='user') {
    div.innerHTML = '<div style="max-width:80%;padding:12px 16px;border-radius:16px 16px 4px 16px;background:var(--primary);color:#000;font-size:.88rem;line-height:1.5;font-weight:500">' + texto + '</div>';
  } else {
    const md = texto.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').split('\n').join('<br>').replace(/^- (.+)/gm,'• $1');
    div.innerHTML = '<div style="width:32px;height:32px;border-radius:50%;background:var(--primary-dim);border:1.5px solid var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="width:16px;height:16px"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div><div style="max-width:85%;padding:14px 16px;border-radius:4px 16px 16px 16px;background:var(--surface-2);border:1px solid var(--border);font-size:.85rem;line-height:1.6;color:var(--white)">' + md + '</div>';
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function klausMensagemStream() {
  const el = document.getElementById('klaus-mensagens');
  if (!el) return null;
  const avatarSvg = '<div style="width:32px;height:32px;border-radius:50%;background:var(--primary-dim);border:1.5px solid var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="width:16px;height:16px"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>';
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:10px;align-items:flex-start';
  const bubble = document.createElement('div');
  bubble.style.cssText = 'max-width:85%;padding:14px 16px;border-radius:4px 16px 16px 16px;background:var(--surface-2);border:1px solid var(--border);font-size:.85rem;line-height:1.6;color:var(--white);white-space:pre-wrap';
  bubble.innerHTML = '<div class="klaus-dot-pulse"><span></span><span></span><span></span></div>';
  div.innerHTML = avatarSvg;
  div.appendChild(bubble);
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return {
    update(text) {
      bubble.textContent = text;
      el.scrollTop = el.scrollHeight;
    },
    finish(text) {
      bubble.style.whiteSpace = '';
      const md = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').split('\n').join('<br>').replace(/^- (.+)/gm,'• $1');
      bubble.innerHTML = md;
      el.scrollTop = el.scrollHeight;
    }
  };
}

async function klausProcessar(pergunta, modoEmpresa) {
  document.getElementById('klaus-intro').style.display = 'none';
  document.getElementById('klaus-chat').style.display = 'block';
  klausMensagem(pergunta, 'user');
  const stream = klausMensagemStream();
  stream?.finish('Maven está temporariamente indisponível. Em breve voltará com novidades!');
}

window.klausPerguntar = function(pergunta, empresa) { klausProcessar(pergunta, empresa||false); };

window.klausEnviar = function() {
  const inp = document.getElementById('klaus-input');
  const txt = inp?.value?.trim();
  if (!txt) return;
  inp.value = '';
  klausProcessar(txt, false);
};

window.klausEnviarChat = function() {
  const inp = document.getElementById('klaus-input-chat');
  const txt = inp?.value?.trim();
  if (!txt) return;
  inp.value = '';
  klausProcessar(txt, false);
};

window.klausReiniciar = function() {
  klausHistorico = [];
  document.getElementById('klaus-intro').style.display = 'block';
  document.getElementById('klaus-chat').style.display = 'none';
  document.getElementById('klaus-mensagens').innerHTML = '';
};

window.salvarPreferencia = function(chave, valor) {
  localStorage.setItem('monvy_pref_' + chave, JSON.stringify(valor));
  aplicarPreferencia(chave, valor);
};

function getPreferencia(chave, padrao) {
  const v = localStorage.getItem('monvy_pref_' + chave);
  return v !== null ? JSON.parse(v) : padrao;
}

function aplicarPreferencia(chave, valor) {
  if (chave === 'notif_dica') {
    const el = document.getElementById('dica-dia-card');
    if (el) el.style.display = valor ? '' : 'none';
  }
  if (chave === 'notif_insights') {
    const el = document.getElementById('insights-panel');
    if (el && !valor) el.style.display = 'none';
  }
  if (chave === 'periodo_padrao') {
    if (typeof setPeriodo === 'function') setPeriodo(valor);
  }
  if (chave === 'pergunta_nd') {
    window._perguntaNDAtiva = valor;
  }
}

function carregarTodasPreferencias() {
  // Notificações
  [['notif_contas','cfg-notif-contas'],
   ['notif_dica','cfg-notif-dica'],
   ['notif_insights','cfg-notif-insights'],
   ['pergunta_nd','cfg-pergunta-nd']].forEach(([chave,id])=>{
    const v = getPreferencia(chave, true);
    const el = document.getElementById(id);
    if (el) el.checked = v;
    aplicarPreferencia(chave, v);
  });
  // Período padrão
  const pd = getPreferencia('periodo_padrao','mes');
  const elPd = document.getElementById('cfg-periodo-padrao');
  if (elPd) elPd.value = pd;
  // Empresa
  const emp = getPreferencia('exibir_empresa', true);
  const swEmp = document.getElementById('cfg-switch-empresa');
  if (swEmp) swEmp.checked = emp;
}

window.configurarExibirEmpresa = function(exibir) {
  salvarPreferencia('exibir_empresa', exibir);
  const btn = document.getElementById('modo-empresa-btn');
  if (btn) btn.style.display = exibir ? '' : 'none';
};

function renderizarConfiguracoes() {
  // Dados do usuário
  const auth = window._firebaseExports?.auth;
  if (auth?.currentUser) {
    const user = auth.currentUser;
    const nome = document.getElementById('cfg-nome');
    const email = document.getElementById('cfg-email');
    const avatar = document.getElementById('cfg-avatar');
    if (nome) nome.textContent = user.displayName || 'Sem nome';
    if (email) email.textContent = user.email || '—';
    if (avatar) {
      if (user.photoURL) {
        avatar.innerHTML = '<img src="' + user.photoURL + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
      } else {
        avatar.textContent = (user.displayName || user.email || 'U')[0].toUpperCase();
      }
    }
    // Sessão
    const sessao = document.getElementById('cfg-sessao-info');
    if (sessao) {
      const metodo = user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'E-mail/Senha';
      sessao.textContent = 'Conectado via ' + metodo + ' — ' + (user.email || '');
    }
  }
  // Tema
  const tema = localStorage.getItem('monvy_theme') || 'dark';
  const btnD = document.getElementById('cfg-btn-dark');
  const btnL = document.getElementById('cfg-btn-light');
  if (btnD) btnD.classList.toggle('active', tema === 'dark');
  if (btnL) btnL.classList.toggle('active', tema === 'light');
  // Todas as preferências
  carregarTodasPreferencias();
}

window.configurarTema = function(tema) {
  if (typeof applyTheme === 'function') applyTheme(tema);
  localStorage.setItem('monvy_theme', tema);
  // Atualizar botões
  const btnD = document.getElementById('cfg-btn-dark');
  const btnL = document.getElementById('cfg-btn-light');
  if (btnD) btnD.classList.toggle('active', tema === 'dark');
  if (btnL) btnL.classList.toggle('active', tema === 'light');
};

window.exportarDadosCompleto = function() {
  if (!movimentacoes.length) { showToast('Nenhuma movimentação para exportar.', 'info'); return; }
  const bom = '﻿';
  const linhas = [
    `# Monvay — Exportação completa`,
    `# Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
    `# Total de movimentações: ${movimentacoes.length}`,
    '',
    'Descrição,Tipo,Valor,Data,Categoria,Classificação,Recorrente',
    ...movimentacoes.map(m =>
      `"${m.descricao||''}","${m.tipo==='ganho'?'Entrada':'Saída'}","${(m.valor||0).toFixed(2)}","${m.data||''}","${m.categoria||''}","${m.classificacao||''}","${m.recorrente?'Sim':'Não'}"`
    )
  ];
  const blob = new Blob([bom + linhas.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'monvay-dados-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
};

window.confirmarExcluirConta = function() {
  confirmarAcao('Isso removerá TODOS os seus dados permanentemente. Esta ação não pode ser desfeita.', async () => {
    const auth = window._firebaseExports?.auth;
    if (!auth?.currentUser) return;
    try {
      // Deletar dados do Firestore seria ideal mas requer regras
      await auth.currentUser.delete();
      localStorage.clear();
      window.location.replace('landing.html');
    } catch(e) {
      if (e.code === 'auth/requires-recent-login') {
        showToast('Por segurança, faça login novamente antes de excluir a conta.', 'error');
        logout();
      } else {
        showToast('Erro ao excluir conta: ' + e.message, 'error');
      }
    }
  });
};

window.abrirSidebar = function() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.add('open');
  if (ov) ov.style.display = 'block';
};
window.fecharSidebar = function() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.style.display = 'none';
};
// Fechar sidebar ao navegar
document.querySelectorAll('.nav-item[data-tela]').forEach(item => {
  item.addEventListener('click', () => window.fecharSidebar());
});

// Limpa movimentações de quitação de dívida geradas por versões antigas
window.limparQuitacoesDuplicadas = async function() {
  if(!uidAtual){ showToast('Faça login primeiro.', 'info'); return; }
  const todas = await getMovimentacoes(uidAtual);
  const quitacoes = todas.filter(m => m.classificacao === 'quitacao_divida');
  if(quitacoes.length === 0){ showToast('Nenhuma quitação para limpar.', 'info'); return; }
  confirmarAcao(`Remover ${quitacoes.length} movimentação(ões) de quitação de dívida?`, async () => {
    for(const m of quitacoes) await deletarMovimentacao(uidAtual, m.id);
    movimentacoes = await getMovimentacoes(uidAtual);
    renderizarListaInicio();
    atualizarKPIs();
    atualizarChart();
    showToast(`${quitacoes.length} movimentação(ões) removida(s) com sucesso!`, 'success');
  });
};


// ── Mapa de ícones por categoria ──────────────────────────────────
const ICONE_CAT={
  // Alimentação
  'Alimentação':'icone-alimentacao.png',
  // Lazer / esporte
  'Lazer':'icone-lazer.png',
  'Academia':'icone-academia.png',
  'Luta / Artes Marciais':'icone-luta.png',
  'Futebol':'icone-futebol.png',
  'Bike':'icone-bicicleta.png',
  // Saúde
  'Saúde':'icone-saude.png',
  // Moradia
  'Moradia':'icone-casa-propria.png',
  'Casa':'icone-casa-propria.png',
  'Aluguel':'icone-casa-aluguel.png',
  'Financiamento':'icone-financiamento.png',
  // Transporte
  'Transporte':'icone-onibus.png',
  'Carro':'icone-carro.png',
  'Moto':'icone-moto.png',
  // Família
  'Bebê / Criança':'icone-bebe.png',
  'Dependentes':'icone-dependentes.png',
  'Pets':'icone-pets.png',
  'Família':'icone-familia.png',
  // Educação
  'Educação':'icone-cerebro.png',
  // Streamings — usa ícone genérico de streaming nas categorias de gasto
  'Netflix':'icone-streaming.png',
  'Spotify':'icone-streaming.png',
  'YouTube Premium':'icone-streaming.png',
  'Max (HBO)':'icone-streaming.png',
  'Prime Video':'icone-streaming.png',
  'Disney+':'icone-streaming.png',
  'ChatGPT Plus':'icone-ferramenta-cognitiva.png',
  'Notion':'icone-ferramenta-cognitiva.png',
  'Canva':'icone-ferramenta-cognitiva.png',
  'CapCut':'icone-ferramenta-cognitiva.png',
  'Assinatura':'icone-streaming.png',
  'Streaming':'icone-streaming.png',
  // Tech
  'Celular':'icone-celular.png',
  'Internet':'icone-internet.png',
  // Finanças
  'Investimento':'icone-investimento.png',
  'Cartão':'icone-cartao-01.png',
  'Dívida':'icone-cadeado.png',
  'Empréstimo':'icone-emprestimo.png',
  // Outros
  'Roupas':'icone-app.png',
  'Beleza':'icone-usuario.png',
  'Outros':'icone-outros.png',
};
function getIconeCat(cat){
  if(!cat) return null;
  // busca exata
  if(ICONE_CAT[cat]) return ICONE_CAT[cat];
  // busca parcial case-insensitive
  const lower=cat.toLowerCase();
  for(const [k,v] of Object.entries(ICONE_CAT)){
    if(lower.includes(k.toLowerCase())) return v;
  }
  return null;
}
function iconeHtml(cat, tipo, size=28){
  const png=getIconeCat(cat);
  if(png) return `<img src="${png}" alt="${cat}" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0">`;
  // fallback: círculo colorido com seta
  const isGanho=tipo==='ganho';
  const bg=isGanho?'rgba(34,197,94,.15)':'rgba(239,68,68,.15)';
  const color=isGanho?'#22c55e':'#ef4444';
  const arrow=isGanho?'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>':'<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" style="width:${Math.round(size*0.5)}px;height:${Math.round(size*0.5)}px">${arrow}</svg></div>`;
}

// ==============================
// MONVAY — LÓGICA PRINCIPAL
// v4.0 | ES Module + Firebase
// ==============================

import {
  auth, db, query, where, collection, getDocs,
  onAuth, fazerLogout, waitAuthReady,
  getPerfil, salvarPerfil as fbSalvarPerfil, salvarPerfilVida as fbSalvarPerfilVida,
  getMovimentacoes, adicionarMovimentacao, atualizarMovimentacao, deletarMovimentacao, ouvirMovimentacoes,
  getMetas, adicionarMeta, atualizarMeta, deletarMeta,
  getDividas, adicionarDivida, atualizarDivida, deletarDivida,
  getContas, adicionarConta, atualizarConta, deletarConta,
  getCartoes, adicionarCartao, atualizarCartao, deletarCartao,
  verificarEResetarMes, getHistorico,
  klausChamarCloud, klausChamarCloudStream
} from './firebase.js';

// ── Estado global ──────────────────────────────────────────────
let uidAtual = null;
let movimentacoes = [];
let metas = [];
let dividas = [];
let contas = [];
let cartoes = [];
let tipoAtual = '';
let respostaPergunta = '';
let metaEditandoId = null;
let contaEditandoId = null;
let movEditandoId = null;
let filtroAtual = 'mes';
let filtroContasAtual = 'todas';
let mesRelatorio = new Date();
let mesContas = new Date();
let periodoModo = 'mes';
let periodoCustomInicio = null;
let periodoCustomFim = null;
let perfilUsuario = {};
window.perfilUsuario = perfilUsuario; // expor para scripts inline do HTML
let chartFluxo = null;
let chartPizza = null;
let tipoGraficoPizza = 'doughnut';

window.setTipoGrafico = function(tipo) {
  tipoGraficoPizza = tipo;
  const btnPizza = document.getElementById('btn-tipo-pizza');
  const btnColuna = document.getElementById('btn-tipo-coluna');
  if(btnPizza && btnColuna) {
    if(tipo === 'doughnut') {
      btnPizza.style.background='var(--primary)'; btnPizza.style.color='#000';
      btnColuna.style.background='transparent'; btnColuna.style.color='var(--gray)';
    } else {
      btnColuna.style.background='var(--primary)'; btnColuna.style.color='#000';
      btnPizza.style.background='transparent'; btnPizza.style.color='var(--gray)';
    }
  }
  // Re-renderizar com dados atuais
  const filtradas = filtrarPorPeriodo(movimentacoes).filter(m=>m.tipo==='gasto'&&naoEQuitacao(m));
  const porCat={};
  filtradas.forEach(m=>{ const c=m.categoria||'Outros'; porCat[c]=(porCat[c]||0)+m.valor; });
  atualizarGraficoPizza(porCat);
};
let chartRelatorio = null;
let taxasLive = {};
let fluxoModo = 'recentes';
let unsubMovs = null;
let tipoPizza = 'doughnut';
let bolsaDados = [];
let bolsaFiltroAtual = 'todos';
let bolsaMostrados = 10;

window.irPara = irPara;
window.setFluxoModo = setFluxoModo;

// ── Helpers ─────────────────────────────────────────────────────
function fmt(valor) {
  return 'R$ ' + Math.abs(Number(valor)||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
// Converte input numérico BR (ex: "10.000,50" ou "10000.50") para float
function parseBR(str) {
  if(!str && str !== 0) return 0;
  const s = String(str).trim()
    .replace(/[R$\s]/g,'')   // remove R$ e espaços
    .replace(/\./g,'')        // remove pontos de milhar
    .replace(',','.');         // vírgula decimal → ponto
  return parseFloat(s) || 0;
}
function fmtSaldo(valor) {
  const v = Number(valor)||0;
  return (v<0?'-':'')+'R$ '+Math.abs(v).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function dataHoje() { return new Date().toISOString().split('T')[0]; }
function fmtData(str) {
  if(!str) return '—';
  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;
}

// ── Tema ────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Atualiza todos os ícones de lua/sol na página (topbar + drawer)
  document.querySelectorAll('[id$="theme-icon-moon"]').forEach(el => {
    el.style.display = theme==='light' ? 'none' : 'block';
  });
  document.querySelectorAll('[id$="theme-icon-sun"]').forEach(el => {
    el.style.display = theme==='light' ? 'block' : 'none';
  });
  // Atualiza texto do botão no drawer se existir
  const drawerBtn = document.getElementById('drawer-theme-btn');
  if(drawerBtn) {
    const span = drawerBtn.querySelector('span');
    if(span) span.textContent = theme==='light' ? 'Modo escuro' : 'Modo claro';
  }
}
window.toggleTheme = function() {
  const cur = localStorage.getItem('monvy_theme')||'dark';
  const nxt = cur==='dark'?'light':'dark';
  localStorage.setItem('monvy_theme', nxt);
  applyTheme(nxt);
};
applyTheme(localStorage.getItem('monvy_theme')||'dark');

// ── CSS dinâmico ─────────────────────────────────────────────────
(function(){
  const s = document.createElement('style');
  s.textContent = `
    .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:700}
    .badge-green{background:rgba(34,197,94,.15);color:#22c55e}
    .badge-red{background:rgba(239,68,68,.15);color:#ef4444}
    .badge-yellow{background:rgba(245,158,11,.15);color:#f59e0b}
    .badge-gray{background:rgba(100,116,139,.15);color:#94a3b8}
    .btn-sm-green{padding:6px 12px;border-radius:8px;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.1);color:#22c55e;cursor:pointer;font-size:.78rem;font-weight:700;font-family:inherit}
    .btn-sm-red{padding:6px 12px;border-radius:8px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.1);color:#ef4444;cursor:pointer;font-size:.78rem;font-weight:700;font-family:inherit}
    .btn-sm-gray{padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--gray);cursor:pointer;font-size:.78rem;font-weight:600;font-family:inherit}
    .btn-icon{background:none;border:none;cursor:pointer;color:var(--gray);padding:4px;display:flex;align-items:center}
    .btn-icon:hover{color:var(--primary)}
    .green{color:#22c55e}.red{color:#ef4444}.gray{color:var(--gray)}
    .categoria-card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px}.categoria-card .cat-info{display:flex;align-items:center;gap:8px;margin-bottom:8px}.cat-picker-item{display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 6px;border-radius:12px;border:1.5px solid var(--border);background:rgba(255,255,255,0.03);cursor:pointer;transition:all .15s;text-align:center;user-select:none}.cat-picker-item:hover{border-color:rgba(34,197,94,0.4);background:rgba(34,197,94,0.04)}.cat-picker-item.selected{border-color:var(--primary);background:rgba(34,197,94,0.12)}.cat-picker-item img{width:26px;height:26px;object-fit:contain}.cat-picker-item .cat-pk-nome{font-size:.68rem;font-weight:600;color:var(--gray-2);line-height:1.2;word-break:break-word}.cat-picker-item.selected .cat-pk-nome{color:var(--primary)}
    .cat-info{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .cat-nome{font-weight:600;font-size:.88rem}.cat-val{font-weight:700;font-size:.9rem}
    .cat-bar-wrap{background:rgba(255,255,255,.06);border-radius:4px;height:6px;margin-bottom:4px;overflow:hidden}
    .cat-bar{height:100%;background:var(--primary);border-radius:4px;transition:width .5s}
    .cat-pct{font-size:.72rem;color:var(--gray)}
    .pizza-leg-item{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:.78rem}
    .pizza-leg-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .pizza-leg-val{margin-left:auto;font-weight:700}
    .insights-list{display:flex;flex-direction:column;gap:10px}.insight-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;cursor:pointer;transition:transform .15s,opacity .15s;flex-wrap:wrap}.insight-card:hover{transform:translateY(-1px);opacity:.92}.insight-icon{width:42px;height:42px;object-fit:contain;flex-shrink:0}.insight-body{flex:1;min-width:180px}.insight-tag{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}.insight-titulo{font-size:.88rem;font-weight:700;color:var(--white);margin-bottom:3px;line-height:1.3}.insight-desc{font-size:.78rem;color:var(--gray-2);line-height:1.45}.insight-acao{flex-shrink:0;padding:7px 14px;border-radius:8px;border:1.5px solid;background:transparent;font-size:.78rem;font-weight:600;cursor:pointer;font-family:var(--font-title);white-space:nowrap}@keyframes fadeInDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeOutUp{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-10px)}}
    .meta-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px}
    .meta-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .meta-nome{font-weight:700}.meta-pct{font-size:.85rem;color:var(--primary);font-weight:700}
    .meta-bar-wrap{background:rgba(255,255,255,.06);border-radius:4px;height:8px;margin-bottom:8px;overflow:hidden}
    .meta-bar{height:100%;background:var(--primary);border-radius:4px;transition:width .5s}
    .meta-valores{display:flex;justify-content:space-between;font-size:.78rem}
    .vida-opt.selected{border-color:var(--primary)!important;background:rgba(0,200,83,.15)!important}
    .contas-filtro-btn{padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--gray);font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit}
    .contas-filtro-btn.active{background:var(--primary);color:#000;border-color:var(--primary)}
    .mov-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer}
    .mov-item:hover{opacity:.8}
    .mov-icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .mov-icon.green{background:rgba(34,197,94,.15);color:#22c55e}
    .mov-icon.red{background:rgba(239,68,68,.15);color:#ef4444}
    .mov-info{flex:1;min-width:0}
    .mov-desc{font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mov-cat{font-size:.72rem;color:var(--gray)}
    .mov-valor{font-weight:700;font-size:.9rem;flex-shrink:0}
  `;
  document.head.appendChild(s);
})();

// ── Navegação ───────────────────────────────────────────────────
const pageTitles = {
  inicio:'Dashboard',gastos:'Gastos',metas:'Metas',dividas:'Dívidas',
  investimentos:'Investimentos',aprender:'Aprender',relatorio:'Relatório Mensal',
  contas:'Contas a Pagar',score:'Score Financeiro'
};
let _telaAnterior = null;
// Inicializar rascunho do perfil — usa localStorage como v1
function _inicializarRascunho() {
  if (!window._perfilVidaTemp) {
    const cached = localStorage.getItem('monvy_perfil_vida');
    window._perfilVidaTemp = cached ? JSON.parse(cached) : JSON.parse(JSON.stringify(perfilUsuario?.perfilVida || {}));
  }
}

// Mapeamento telas antigas → novas
const _telaMap = {
  contas:'compromissos', dividas:'compromissos',
  score:'analise'
};
const _subTabMap = {
  contas:['compromissos','contas'], dividas:['compromissos','dividas'],
  score:['analise','score']
};

// Sub-abas
window.setSubTab = function(pai, sub) {
  const grupos = {compromissos:['contas','dividas'], analise:['score']};
  (grupos[pai]||[]).forEach(p=>{
    const el=document.getElementById('sub-conteudo-'+p);
    const btn=document.getElementById('sub-tab-'+p);
    if(el) el.style.display='none';
    if(btn) btn.classList.remove('active');
  });
  const alvo=document.getElementById('sub-conteudo-'+sub);
  const btnA=document.getElementById('sub-tab-'+sub);
  if(alvo) alvo.style.display='block';
  if(btnA) btnA.classList.add('active');
  // Mover conteúdo da tela original para sub-aba na primeira vez
  function mover(telaId, subId){
    const tela=document.getElementById('tela-'+telaId);
    const subEl=document.getElementById(subId);
    if(tela&&subEl&&subEl.children.length===0){
      while(tela.firstChild) subEl.appendChild(tela.firstChild);
    }
  }
  if(sub==='contas'){mover('contas','sub-conteudo-contas');renovarContasRecorrentes().then(()=>{sincronizarFaturasComContas().then(()=>{renderizarContas();renderizarCartoes();renderizarFaturasCartao();});});popularSelectContas();}
  if(sub==='dividas'){mover('dividas','sub-conteudo-dividas');renderizarDividas();}
  if(sub==='score'){mover('score','sub-conteudo-score');calcularScore();}
};

function irPara(tela) {
  const telaNova = _telaMap[tela] || tela;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.tela').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll(`[data-tela="${telaNova}"]`).forEach(n=>n.classList.add('active'));
  const telaEl=document.getElementById('tela-'+telaNova);
  if(telaEl) telaEl.classList.add('active');
  const tituloMapa = {
    ...pageTitles,
    compromissos:'Compromissos',
    analise:'Análise'
  };
  const t=tituloMapa[telaNova]||tituloMapa[tela]||'Monvay';
  const pt=document.getElementById('page-title'); if(pt) pt.textContent=t;
  const mt=document.getElementById('topbar-mobile-tela'); if(mt) mt.textContent=t;
  if(tela==='gastos'){atualizarTelaCategorias();renderizarTabela();}
  if(tela==='configuracoes') renderizarConfiguracoes();
  if(tela==='metas') renderizarMetas();
  // Sub-abas
  if(_subTabMap[tela]){
    setTimeout(()=>setSubTab(_subTabMap[tela][0],_subTabMap[tela][1]),10);
  } else if(telaNova==='compromissos'){
    setTimeout(()=>setSubTab('compromissos','contas'),10);
  } else if(telaNova==='analise'){
    setTimeout(()=>setSubTab('analise','score'),10);
  }
  if(tela==='relatorio') renderizarRelatorio();
  if(tela==='inicio' && _telaAnterior && _telaAnterior!=='inicio'){
    gerarInsights();
  } else if(tela==='inicio'){
    const panel=document.getElementById('insights-panel');
    if(panel) panel.style.display='none';
  }
  _telaAnterior = tela;
}
document.querySelectorAll('.nav-item[data-tela]').forEach(item=>{
  item._monvayNavBound=true;
  item.addEventListener('click',function(e){e.preventDefault();irPara(this.dataset.tela);});
});

// ── Auth ─────────────────────────────────────────────────────────
window.logout = async function() {
  if(unsubMovs) unsubMovs();
  localStorage.removeItem('monvy_logado');
  localStorage.removeItem('monvy_logged');
  await fazerLogout();
  window.location.href='landing.html';
};
// Timeout de segurança — remove loading após 6s mesmo se algo falhar
setTimeout(()=>{
  const ov=document.getElementById('app-loading-overlay');
  if(ov&&ov.style.display!=='none') {
    ov.style.display='none';
    console.warn('Loading removido por timeout de segurança');
  }
},6000);

waitAuthReady().then(()=>{
  onAuth(async user=>{
    // Esconder overlay de loading imediatamente
    const appOverlay=document.getElementById('app-loading-overlay');
    if(appOverlay) appOverlay.style.display='none';
    if(!user){
      localStorage.removeItem('monvy_onboarding_done');
      localStorage.removeItem('monvy_modo_empresa');
      window.location.href='landing.html';
      return;
    }
    localStorage.setItem('monvy_onboarding_done','1');
    uidAtual=user.uid;
    window._firebaseExports={auth:{currentUser:user},db};
    const nome=user.displayName||'Usuário';
    const foto=user.photoURL||localStorage.getItem('monvy_avatar_foto');
    atualizarUIUsuario(nome,foto);
    localStorage.setItem('monvy_logado',JSON.stringify({nome,uid:user.uid}));
    try{perfilUsuario=await getPerfil(user.uid)||{};}catch(e){perfilUsuario={};}
    // Carregar perfilVida do localStorage como fallback imediato
    if(!perfilUsuario.perfilVida){
      const cached=localStorage.getItem('monvy_perfil_vida');
      if(cached) try{perfilUsuario.perfilVida=JSON.parse(cached);}catch(e){}
    } else {
      // Sincronizar localStorage com o que veio do Firebase
      localStorage.setItem('monvy_perfil_vida', JSON.stringify(perfilUsuario.perfilVida));
    }
    // Manter window.perfilUsuario sempre sincronizado
    window.perfilUsuario = perfilUsuario;
    try{await verificarEResetarMes(user.uid);}catch(e){}
    // app pronto
    try { await carregarTodosDados(); } catch(e) { console.error('carregarTodosDados erro:', e); }
    if(unsubMovs) unsubMovs();
    unsubMovs=ouvirMovimentacoes(user.uid,movs=>{
      movimentacoes=movs;
      atualizarKPIs();atualizarChart();renderizarListaInicio();renderizarTabela();calcularScore();mostrarBannerEmpresa();
    });
  });
});

async function carregarTodosDados(){
  try{
    // Carregar com tratamento individual de erro
    const [movs,mts,divs,cnts,crts]=await Promise.all([
      getMovimentacoes(uidAtual).catch(e=>{console.error('Erro movimentacoes:',e);return [];}),
      getMetas(uidAtual).catch(e=>{console.error('Erro metas:',e);return [];}),
      getDividas(uidAtual).catch(e=>{console.error('Erro dividas:',e);return [];}),
      getContas(uidAtual).catch(e=>{console.error('Erro contas:',e);return [];}),
      getCartoes(uidAtual).catch(e=>{console.error('Erro cartoes:',e);return [];})
    ]);
    movimentacoes=movs;metas=mts;dividas=divs;contas=cnts;cartoes=crts;
    atualizarKPIs();atualizarChart();renderizarListaInicio();
    renderizarTabela();renderizarMetas();renderizarDividas();renderizarContas();popularSelectContas();
    renderizarLembretesFaturas();
    renderizarRelatorio();calcularScore();atualizarBanner();
    // Atualizar cards premium com dados reais
    if(typeof renderDbMeta==='function') renderDbMeta();
    if(typeof renderDbScore==='function') renderDbScore();
    if(typeof renderDbContas==='function') renderDbContas();
    if(typeof renderDbPrevisao==='function') renderDbPrevisao();
    if(typeof renderDbFluxo==='function') renderDbFluxo();
    // Insights só aparecem ao VOLTAR para o dashboard, não na primeira vez
    carregarTaxasBCB();
    // Inicializar período padrão como mês atual
    if(typeof setPeriodo==='function') setPeriodo('mes');
    // Aplicar preferência de ocultar saldo
    setTimeout(()=>{ if(typeof aplicarMascaraSaldo==='function') aplicarMascaraSaldo(); }, 300);
    // Dashboard premium
    setTimeout(()=>{ if(typeof atualizarDashboardPremium==='function') atualizarDashboardPremium(); }, 500);
    setTimeout(()=>{ if(typeof gerarInsightsMavenWidget==='function') gerarInsightsMavenWidget(); }, 800);
  }catch(e){console.error('Erro ao carregar dados:',e);}
}

function atualizarUIUsuario(nome,foto){
  // Atualizar nome na nova sidebar
  const sbName = document.getElementById('sidebar-user-name');
  if (sbName) sbName.textContent = nome ? nome.split(' ')[0] : 'Minha conta';
  const inicial=nome?nome[0].toUpperCase():'U';
  const mn=document.getElementById('topbar-mobile-name'); if(mn) mn.textContent='Olá, '+nome.split(' ')[0];
  const dn=document.getElementById('drawer-user-name'); if(dn) dn.textContent=nome;
  const da=document.getElementById('drawer-avatar');
  if(da){if(foto)da.innerHTML=`<img src="${foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;else{da.textContent=inicial;da.style.background='var(--primary)';}}
  const sa=document.getElementById('user-avatar');
  if(sa){if(foto)sa.innerHTML=`<img src="${foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;else sa.textContent=inicial;}
  const ma=document.getElementById('topbar-avatar-mobile');
  const daDesktop=document.getElementById('topbar-avatar-desktop');
  if(daDesktop&&foto){ daDesktop.src=foto; }
  else if(daDesktop){ daDesktop.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="%2300c853"/><text x="18" y="24" text-anchor="middle" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="%23000000">'+inicial+'</text></svg>'; }
  // Saudação por hora
  const hora = new Date().getHours();
  const saudacao = hora>=5&&hora<12 ? 'Bom dia,' : hora>=12&&hora<18 ? 'Boa tarde,' : 'Boa noite,';
  const elSaud = document.getElementById('topbar-saudacao');
  const elNome = document.getElementById('topbar-nome-desktop');
  if(elSaud) elSaud.textContent = saudacao;
  if(elNome) elNome.textContent = nome||'Usuário';
  if(ma){if(foto)ma.src=foto;else{const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="%2300c853"/><text x="18" y="24" text-anchor="middle" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="%23000000">${inicial}</text></svg>`;ma.src='data:image/svg+xml,'+svg;}}
  const gr=document.getElementById('topbar-greeting');
  if(gr){const h=new Date().getHours();const s=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';gr.textContent=`${s}, ${nome.split(' ')[0]}!`;}
}

// ── KPIs ─────────────────────────────────────────────────────────
function atualizarKPIs(){
  // Totais globais (saldo real = todas as movimentações)
  const entTot=movimentacoes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const saiTot=movimentacoes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const sal=entTot-saiTot;

  // Filtradas pelo período selecionado
  const filtradas=filtrarPorPeriodo(movimentacoes);
  const ent=filtradas.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const sai=filtradas.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);

  // Falta pagar = contas pendentes não pagas
  const faltaPagar=contas.filter(c=>!c.paga&&c.tipo==='pagar').reduce((s,c)=>s+(c.valor||0),0);

  // Saldo disponível = saldo atual - falta pagar
  const saldoDisp=sal-faltaPagar;

  // Atualizar DOM
  const sd=document.getElementById('saldo-display');
  if(sd){sd.textContent=fmtSaldo(sal);sd.style.color=sal<0?'#ef4444':'';}

  const sm=document.getElementById('saldo-mes');
  if(sm){
    const labels={semana:'Esta semana',mes:'Este mês','3meses':'3 meses',ano:'Este ano',tudo:'Total'};
    sm.textContent=`${labels[filtroAtual]||'Este mês'}: +${fmt(ent)} entrou`;
  }

  const ke=document.getElementById('kpi-entradas'); if(ke) ke.textContent=fmt(ent);
  const ks=document.getElementById('kpi-saidas');   if(ks) ks.textContent=fmt(sai);
  const km=document.getElementById('kpi-movs');     if(km) km.textContent=filtradas.length;

  // Falta pagar
  const kfp=document.getElementById('kpi-falta-pagar');
  if(kfp){kfp.textContent=fmt(faltaPagar);kfp.style.color=faltaPagar>0?'#ef4444':'#22c55e';}

  // Saldo disponível
  const ksd=document.getElementById('kpi-saldo-disponivel');
  if(ksd){ksd.textContent=fmtSaldo(saldoDisp);ksd.style.color=saldoDisp<0?'#ef4444':'';}

  // Aplicar máscara se saldo estiver oculto
  if(typeof aplicarMascaraSaldo==='function') aplicarMascaraSaldo();
}

// ── Chart fluxo ──────────────────────────────────────────────────
function setFluxoModo(modo){
  fluxoModo=modo;
  const br=document.getElementById('btn-fluxo-recentes');
  const bt=document.getElementById('btn-fluxo-todas');
  if(br){br.style.background=modo==='recentes'?'#22c55e':'transparent';br.style.color=modo==='recentes'?'#000':'#64748b';}
  if(bt){bt.style.background=modo==='todas'?'#22c55e':'transparent';bt.style.color=modo==='todas'?'#000':'#64748b';}
  atualizarChart();
}
function atualizarChart(){
  const container=document.getElementById('chart-fluxo-container');
  const canvas=document.getElementById('chart-fluxo');
  const emptyEl=document.getElementById('chart-empty');
  if(!canvas) return;
  if(movimentacoes.length===0){
    if(container)container.style.display='none';
    canvas.style.display='none';
    if(emptyEl)emptyEl.style.display='flex';
    return;
  }
  if(container)container.style.display='block';
  canvas.style.display='block';
  if(emptyEl)emptyEl.style.display='none';
  if(!canvas.offsetWidth){setTimeout(atualizarChart,100);return;}
  const w=(container?container.offsetWidth:null)||canvas.parentElement?.offsetWidth||canvas.offsetWidth||600;
  canvas.width=w;
  canvas.height=300;
  // Recentes: últimos 8 dias INCLUINDO HOJE | Todas: mês atual completo
  let lista;
  if(fluxoModo==='recentes'){
    const corte=new Date(); corte.setDate(corte.getDate()-8); corte.setHours(0,0,0,0);
    lista=movimentacoes.filter(m=>m.data&&new Date(m.data+'T00:00:00')>=corte&&(m.tipo==='ganho'||naoEQuitacao(m)));
  } else {
    const hoje=new Date();
    const anoMes=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    lista=movimentacoes.filter(m=>m.data&&m.data.startsWith(anoMes)&&(m.tipo==='ganho'||naoEQuitacao(m)));
  }
  // Sem movimentações no período → mostrar vazio
  if(lista.length===0){
    if(container)container.style.display='none';
    canvas.style.display='none';
    if(emptyEl){
      emptyEl.style.display='flex';
      emptyEl.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;opacity:.3"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>${fluxoModo==='recentes'?'Nenhuma movimentação nos últimos 8 dias':'Nenhuma movimentação este mês'}</span>`;
    }
    const subEl2=document.getElementById('fluxo-sub');
    if(subEl2) subEl2.textContent=fluxoModo==='recentes'?'Últimos 8 dias (0 movimentações)':'Este mês (0 movimentações)';
    return;
  }
  if(container)container.style.display='block';
  canvas.style.display='block';
  if(emptyEl)emptyEl.style.display='none';
  // Ordenar do mais antigo para o mais recente (ordem cronológica exata)
  const listaRev=[...lista].sort((a,b)=>{
    // Primeiro: ordena por data
    const dataCompare=(a.data||'').localeCompare(b.data||'');
    if(dataCompare!==0) return dataCompare;
    // Se mesma data: usa criadoEm (serverTimestamp do Firebase)
    if(a.criadoEm && b.criadoEm) {
      const tA = a.criadoEm.toMillis ? a.criadoEm.toMillis() : a.criadoEm;
      const tB = b.criadoEm.toMillis ? b.criadoEm.toMillis() : b.criadoEm;
      return tA - tB;
    }
    // Fallback: IDs do Firebase são ordenados cronologicamente
    return (a.id||'').localeCompare(b.id||'');
  });
  // Atualizar subtítulo
  const subEl=document.getElementById('fluxo-sub');
  if(subEl){
    const diasLabel=fluxoModo==='recentes'?'Últimos 8 dias':'Este mês';
    subEl.textContent=`${diasLabel} (${listaRev.length} ${listaRev.length===1?'movimentação':'movimentações'})`;
  }
  // Labels inteligentes: mostra data apenas na primeira ocorrência de cada dia
  const labels=listaRev.map((m,i)=>{
    if(!m.data) return `#${i+1}`;
    const dataFormatada=fmtData(m.data).slice(0,5);
    // Se é a primeira transação do dia, mostra a data
    if(i===0 || listaRev[i-1].data!==m.data) return dataFormatada;
    // Se não, retorna vazio (próxima transação do mesmo dia)
    return '';
  });
  const datas=listaRev.map(m=>m.data?fmtData(m.data):'');
  const nomes=listaRev.map(m=>m.descricao||m.categoria||'Movimentação');
  const tipos=listaRev.map(m=>m.tipo);
  const entradas=listaRev.map(m=>m.tipo==='ganho'?m.valor:0);
  const saidas=listaRev.map(m=>m.tipo==='gasto'?m.valor:0);
  if(chartFluxo){chartFluxo.destroy();chartFluxo=null;}
  const ctx=canvas.getContext('2d');
  const gG=ctx.createLinearGradient(0,0,0,180);gG.addColorStop(0,'rgba(34,197,94,0.3)');gG.addColorStop(1,'rgba(34,197,94,0)');
  const gR=ctx.createLinearGradient(0,0,0,180);gR.addColorStop(0,'rgba(239,68,68,0.25)');gR.addColorStop(1,'rgba(239,68,68,0)');

  // Plugin crosshair: linha vertical ao hover/touch
  const crosshairPlugin={
    id:'crosshair',
    afterDraw(chart){
      if(chart._crosshairX==null) return;
      const {ctx,chartArea:{top,bottom}}=chart;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chart._crosshairX,top);
      ctx.lineTo(chart._crosshairX,bottom);
      ctx.strokeStyle='rgba(255,255,255,0.18)';
      ctx.lineWidth=1;
      ctx.setLineDash([4,4]);
      ctx.stroke();
      ctx.restore();
    }
  };

  // Função utilitária para obter posição relativa ao canvas (mouse ou toque)
  function getPosCanvas(e){
    const rect=canvas.getBoundingClientRect();
    const src=e.touches?e.touches[0]:e;
    return {x:src.clientX-rect.left, y:src.clientY-rect.top};
  }

  // Ativa tooltip no ponto mais próximo (entrada OU saída separadamente)
  function ativarTooltip(x,y){
    if(!chartFluxo) return;
    const ca=chartFluxo.chartArea;
    if(!ca) return;
    const numPts=labels.length;
    const step=(ca.right-ca.left)/(numPts-1||1);
    const idx=Math.max(0,Math.min(numPts-1,Math.round((x-ca.left)/step)));
    // Descobre qual dataset tem valor nesse índice (entrada ou saída)
    const temEntrada=entradas[idx]>0;
    const temSaida=saidas[idx]>0;
    // Calcula distância Y para cada dataset que tem valor
    let melhorDs=0;
    if(temEntrada&&temSaida){
      // Ambos têm valor — escolhe o mais próximo do toque em Y
      const scaleY=chartFluxo.scales.y;
      const yEnt=scaleY.getPixelForValue(entradas[idx]);
      const ySai=scaleY.getPixelForValue(saidas[idx]);
      melhorDs=Math.abs(y-yEnt)<Math.abs(y-ySai)?0:1;
    } else if(temSaida){
      melhorDs=1;
    } else {
      melhorDs=0;
    }
    chartFluxo._crosshairX=ca.left+idx*step;
    chartFluxo.tooltip.setActiveElements(
      [{datasetIndex:melhorDs,index:idx}],
      {x:chartFluxo._crosshairX,y}
    );
    chartFluxo.update('none');
  }

  chartFluxo=new Chart(ctx,{type:'line',data:{labels,datasets:[
    {label:'Entradas',data:entradas,borderColor:'#22C55E',backgroundColor:gG,borderWidth:2,tension:0.4,fill:true,pointRadius:5,pointHoverRadius:9,pointBackgroundColor:'#22C55E',pointHoverBackgroundColor:'#22C55E',pointBorderWidth:0,pointHoverBorderWidth:0,pointHitRadius:24},
    {label:'Saídas',data:saidas,borderColor:'#EF4444',backgroundColor:gR,borderWidth:2,tension:0.4,fill:true,pointRadius:5,pointHoverRadius:9,pointBackgroundColor:'#EF4444',pointHoverBackgroundColor:'#EF4444',pointBorderWidth:0,pointHoverBorderWidth:0,pointHitRadius:24}
  ]},options:{
    responsive:false,
    maintainAspectRatio:false,
    interaction:{mode:'nearest',intersect:true},
    onHover:(event,elements,chart)=>{
      if(event.native&&event.native.type!=='touchstart'){
        const pos=getPosCanvas(event.native);
        chart._crosshairX=pos.x;
      }
    },
    plugins:{
      legend:{display:false},
      tooltip:{
        enabled:true,
        mode:'nearest',
        intersect:true,
        position:'nearest',
        xAlign:'center',
        yAlign:'bottom',
        backgroundColor:'rgba(15,23,42,0.96)',
        borderColor:'rgba(255,255,255,0.12)',
        borderWidth:1,
        titleColor:'#94a3b8',
        bodyColor:'#f1f5f9',
        titleFont:{size:12,weight:'600'},
        bodyFont:{size:13,weight:'bold'},
        padding:12,
        cornerRadius:10,
        caretSize:6,
        displayColors:true,
        boxWidth:10,
        boxHeight:10,
        callbacks:{
          title:function(items){
            const i=items[0].dataIndex;
            return datas[i]||labels[i]||'';
          },
          label:function(item){
            if(item.raw===0) return null;
            const i=item.dataIndex;
            const desc=nomes[i]||'Movimentação';
            const isEnt=item.datasetIndex===0;
            const val=item.raw.toLocaleString('pt-BR',{minimumFractionDigits:2});
            return ` ${desc} : ${isEnt?'+':'-'}R$ ${val}`;
          },
          labelColor:function(item){
            return {
              borderColor:'transparent',
              backgroundColor:item.datasetIndex===0?'#22c55e':'#ef4444',
              borderRadius:3
            };
          }
        }
      }
    },
    scales:{
      x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:11}}},
      y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:11},callback:v=>'R$'+v.toLocaleString('pt-BR')}}
    }
  },plugins:[crosshairPlugin]});

  // ── Touch mobile e clique desktop ──────────────────────────────
  // Remove listeners antigos via flag
  if(canvas._tooltipListeners){
    canvas.removeEventListener('touchstart',canvas._tooltipListeners.ts);
    canvas.removeEventListener('touchmove',canvas._tooltipListeners.tm);
    canvas.removeEventListener('touchend',canvas._tooltipListeners.te);
    canvas.removeEventListener('click',canvas._tooltipListeners.cl);
  }
  function handleTouch(e){
    e.preventDefault();
    e.stopPropagation();
    const pos=getPosCanvas(e);
    ativarTooltip(pos.x,pos.y);
  }
  function handleTouchEnd(){
    setTimeout(()=>{
      if(chartFluxo){
        chartFluxo._crosshairX=null;
        chartFluxo.tooltip.setActiveElements([],{});
        chartFluxo.update('none');
      }
    },2500);
  }
  function handleClick(e){
    const pos=getPosCanvas(e);
    ativarTooltip(pos.x,pos.y);
  }
  canvas._tooltipListeners={ts:handleTouch,tm:handleTouch,te:handleTouchEnd,cl:handleClick};
  canvas.addEventListener('touchstart',handleTouch,{passive:false});
  canvas.addEventListener('touchmove',handleTouch,{passive:false});
  canvas.addEventListener('touchend',handleTouchEnd,{passive:false});
  canvas.addEventListener('click',handleClick);
}

// ── Lista início ──────────────────────────────────────────────────

function renderizarListaInicio(){
  const el=document.getElementById('lista-inicio'); if(!el) return;
  const recentes=[...movimentacoes].slice(0,8);
  if(recentes.length===0){el.innerHTML='<div class="vazio">Nenhuma movimentação ainda.</div>';return;}
  const textoMetodo={dinheiro:'Dinheiro',cartao:'Cartão',pix:'Pix'};
  el.innerHTML=recentes.map(m=>{
    const metodoText=m.tipo==='gasto'&&m.metodoPagamento?` · ${textoMetodo[m.metodoPagamento]||''}`:'';
    return `<div class="mov-item" style="padding:16px 14px;" onclick="abrirModalEditar('${m.id}')">
      <div class="mov-left">
        <div class="mov-dot ${m.tipo==='ganho'?'g':'r'}"></div>
        <div class="mov-info">
          <span class="mov-desc">${m.descricao||(m.tipo==='ganho'?'Entrada':'Saída')}</span>
          <span class="mov-cat">${m.data?fmtData(m.data)+' · ':''}${m.tipo==='ganho'?'Entrada':m.categoria||'—'}${metodoText}</span>
        </div>
      </div>
      <span class="mov-valor ${m.tipo==='ganho'?'positivo':'negativo'}">${m.tipo==='ganho'?'+':'-'}${fmt(m.valor)}</span>
    </div>`;
  }).join('');
}

// ── Modal registrar ───────────────────────────────────────────────
let metodoPagamentoAtual='dinheiro';

window.selecionarMetodo=function(metodo){
  metodoPagamentoAtual=metodo;
  document.querySelectorAll('.metodo-pill').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.metodo===metodo);
  });

  // Mostrar/ocultar campos específicos de cartão
  const cartaoDiv=document.getElementById('modal-cartao-detalhes');
  if(cartaoDiv){
    if(metodo==='cartao'){
      cartaoDiv.style.display='block';
      // Popular select com cartões cadastrados
      const select=document.getElementById('modal-select-cartao');
      if(select){
        select.innerHTML='<option value="">Selecione um cartão</option>'+
          cartoes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
      }
    }else{
      cartaoDiv.style.display='none';
    }
  }
};

window.abrirModal=function(tipo){
  tipoAtual=tipo;respostaPergunta='';metodoPagamentoAtual='dinheiro';
  const modal=document.getElementById('modal');
  const titulo=document.getElementById('modal-titulo');
  if(titulo) titulo.textContent=tipo==='ganho'?'+ Nova entrada':'- Novo gasto';
  const perg=document.getElementById('modal-pergunta'); if(perg) perg.classList.add('hidden');
  const mv=document.getElementById('modal-valor'); if(mv) mv.value='';
  document.getElementById('modal-descricao').value='';

  // Preencher data de hoje
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  const dataInput = document.getElementById('modal-data');
  const dataDisplayInput = document.getElementById('modal-data-display');
  if (dataInput) {
    if (dataInput.type === 'date') {
      dataInput.value = ano + '-' + mes + '-' + dia;
    } else {
      dataInput.value = ano + '-' + mes + '-' + dia;
    }
  }
  if (dataDisplayInput) {
    dataDisplayInput.value = dia + '/' + mes + '/' + ano;
  }

  document.getElementById('modal-recorrente').checked=false;

  // Mostrar/ocultar método de pagamento
  const metodoDiv=document.getElementById('modal-metodo-pagamento');
  const cartaoDiv=document.getElementById('modal-cartao-detalhes');
  if(metodoDiv){
    metodoDiv.style.display=tipo==='gasto'?'block':'none';
    // Reset para dinheiro
    document.querySelectorAll('.metodo-pill').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.metodo==='dinheiro');
    });
    // Ocultar detalhes do cartão
    if(cartaoDiv)cartaoDiv.style.display='none';
    // Limpar campos do cartão
    const nomeInput=document.getElementById('modal-cartao-nome');
    const corteInput=document.getElementById('modal-cartao-corte');
    const vencInput=document.getElementById('modal-cartao-vencimento');
    if(nomeInput)nomeInput.value='';
    if(corteInput)corteInput.value='';
    if(vencInput)vencInput.value='';
  }

  atualizarCategoriasModal(tipo);
  if(modal){
    modal.classList.remove('hidden');
    modal.style.display='flex';
    modal.style.visibility='visible';
    modal.style.pointerEvents='auto';
    modal.style.opacity='1';
  }
  setTimeout(()=>{if(mv)mv.focus();},100);
};
window.fecharModal=function(){
  const modal=document.getElementById('modal');
  if(modal){
    modal.classList.add('hidden');
    modal.style.display='none';
    modal.style.visibility='hidden';
    modal.style.pointerEvents='none';
  }
};
function atualizarCategoriasModal(tipo){
  const hidden=document.getElementById('modal-categoria'); if(!hidden) return;
  const cats=tipo==='ganho'?['Salário','Freelance','Investimento','Presente','Outros']:getCategoriasPorPerfil();
  const picker=document.getElementById('modal-categoria-picker');
  if(picker){
    const current=hidden.value||cats[0];
    picker.innerHTML=cats.map(c=>{
      const png=getIconeCat(c);
      const ico=png?`<img src="${png}" alt="${c}">`:`<img src="icone-dinheiro-01.png" style="width:26px;height:26px;object-fit:contain;border-radius:50%">`;
      return `<div class="cat-picker-item${c===current?' selected':''}" onclick="selecionarCategoriaPicker(this,'modal-categoria','modal-categoria-picker')" data-val="${c}">${ico}<span class="cat-pk-nome">${c}</span></div>`;
    }).join('');
    if(!cats.includes(hidden.value)) hidden.value=cats[0];
  } else {
    // fallback select
    hidden.innerHTML=cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  }
}
// Mapa de chaves fixas → nome de exibição
const ROTINA_NOMES={
  academia:'Academia',luta:'Luta / Artes Marciais',futebol:'Futebol',
  netflix:'Netflix',spotify:'Spotify',youtube:'YouTube Premium',
  hbo:'Max (HBO)',prime:'Prime Video',disney:'Disney+',
  chatgpt:'ChatGPT Plus',notion:'Notion',canva:'Canva',capcut:'CapCut',
  internet:'Internet',celular:'Celular',
};
function getCategoriasPorPerfil(){
  const vida=perfilUsuario?.perfilVida||{};
  const rotina=vida.rotina||[];
  const transporte=vida.transporte||[];
  const familia=vida.familia||[];
  const moradia=vida.moradia||null;
  const filhos=vida.filhos||null;

  // Apenas categorias essenciais sempre presentes
  const base=['Alimentação','Saúde','Lazer','Outros'];
  const extra=[];

  // ── Moradia — só adiciona se perfil tem moradia configurada ──
  if(moradia==='aluguel') extra.push('Aluguel');
  else if(moradia==='financiada') extra.push('Financiamento');
  else if(moradia==='propria') extra.push('Moradia');
  // sem moradia selecionada = não adiciona

  // ── Transporte — só do perfil ─────────────────
  if(transporte.includes('carro')) extra.push('Carro');
  if(transporte.includes('moto')) extra.push('Moto');
  if(transporte.includes('publico')||transporte.includes('app')) extra.push('Transporte');
  if(transporte.includes('bike')) extra.push('Bike');

  // ── Filhos / família — só do perfil ──────────
  if(filhos==='sim') extra.push('Bebê / Criança');
  if(familia.includes('dependentes')) extra.push('Dependentes');
  if(familia.includes('pets')) extra.push('Pets');

  // ── Atividade física — só do perfil ──────────
  ['academia','luta','futebol'].forEach(r=>{
    if(rotina.includes(r)) extra.push(ROTINA_NOMES[r]);
  });

  // ── Streamings e ferramentas — só do perfil ──
  ['netflix','spotify','youtube','hbo','prime','disney','chatgpt','notion','canva','capcut'].forEach(r=>{
    if(rotina.includes(r)) extra.push(ROTINA_NOMES[r]);
  });

  // ── Internet / Celular — só do perfil ────────
  if(rotina.includes('internet')) extra.push('Internet');
  if(rotina.includes('celular'))  extra.push('Celular');

  // ── Itens customizados ────────────────────────
  rotina.filter(r=>!ROTINA_NOMES[r]&&typeof r==='string'&&r.trim()).forEach(r=>{
    const nome=r.trim();
    if(!extra.includes(nome)) extra.push(nome);
  });

  // Remover duplicatas e retornar
  const todas=[...base,...extra];
  return todas.filter((v,i,a)=>a.indexOf(v)===i);
}
window.selecionarCategoriaPicker=function(el,hiddenId,pickerId){
  const hidden=document.getElementById(hiddenId);
  const picker=document.getElementById(pickerId);
  if(hidden) hidden.value=el.dataset.val;
  if(picker) picker.querySelectorAll('.cat-picker-item').forEach(i=>i.classList.toggle('selected',i===el));
};
window.responderPergunta=function(resp){
  respostaPergunta=resp;
  document.getElementById('modal-pergunta').classList.add('hidden');
  salvarMovimentacao();
};
window.confirmarModal=async function(){
  const valor=parseFloat(document.getElementById('modal-valor').value);
  if(!valor||valor<=0){showToast('Informe um valor válido.','error');return;}
  if(tipoAtual==='gasto'){
    const perg=document.getElementById('modal-pergunta');
    if(perg&&perg.classList.contains('hidden')&&!respostaPergunta){perg.classList.remove('hidden');return;}
  }
  await salvarMovimentacao();
};
function calcularFatura(dataTransacao,diaCorte){
  const [ano,mes,dia]=dataTransacao.split('-').map(Number);
  const diaNum=Number(dia);
  const mesNum=Number(mes);
  const anoNum=Number(ano);

  // Se a compra foi feita após o corte, vai para a próxima fatura
  if(diaNum>diaCorte){
    // Próximo mês
    if(mesNum===12){
      return `${anoNum+1}-01`;
    }else{
      return `${anoNum}-${String(mesNum+1).padStart(2,'0')}`;
    }
  }else{
    // Fatura do mês atual
    return `${anoNum}-${String(mesNum).padStart(2,'0')}`;
  }
}

async function salvarMovimentacao(){
  const valor=parseFloat(document.getElementById('modal-valor').value);
  const descricao=document.getElementById('modal-descricao').value.trim()||'Sem descrição';
  const data=document.getElementById('modal-data').value||dataHoje();
  const categoria=document.getElementById('modal-categoria').value;
  const recorrente=document.getElementById('modal-recorrente').checked;
  const movimentacao={valor,descricao,tipo:tipoAtual,data,categoria,recorrente,classificacao:respostaPergunta||null};

  // Adicionar método de pagamento se for gasto
  if(tipoAtual==='gasto'){
    movimentacao.metodoPagamento=metodoPagamentoAtual;

    // Se for cartão, vincular ao cartão selecionado
    if(metodoPagamentoAtual==='cartao'){
      const cartaoId=document.getElementById('modal-select-cartao').value;

      if(!cartaoId){
        showToast('Selecione um cartão','error');
        return;
      }

      const cartaoSelecionado=cartoes.find(c=>c.id===cartaoId);
      if(!cartaoSelecionado){
        showToast('Cartão não encontrado','error');
        return;
      }

      movimentacao.cartaoId=cartaoId;
      movimentacao.cartao={
        nome:cartaoSelecionado.nome,
        diaCorte:cartaoSelecionado.diaCorte,
        diaVencimento:cartaoSelecionado.diaVencimento
      };

      // Calcular qual fatura pertence
      movimentacao.fatura=calcularFatura(data,cartaoSelecionado.diaCorte);
    }
  }

  try{
    await adicionarMovimentacao(uidAtual,movimentacao);
    // Se for gasto de cartão, sincronizar faturas
    if(tipoAtual==='gasto'&&metodoPagamentoAtual==='cartao'){
      await sincronizarFaturasComContas();
    }
    fecharModal();respostaPergunta='';
  }catch(e){showToast('Erro ao salvar. Tente novamente.','error');console.error(e);}
}

// ── Modal editar ──────────────────────────────────────────────────
window.abrirModalEditar=function(id){
  console.log('[DEBUG] abrirModalEditar chamado com ID:', id);
  const m=movimentacoes.find(x=>x.id===id);
  console.log('[DEBUG] Movimentação encontrada:', m);
  if(!m) {
    console.error('[DEBUG] Movimentação não encontrada!');
    return;
  }
  movEditandoId=id;
  document.getElementById('edit-valor').value=m.valor;
  document.getElementById('edit-descricao').value=m.descricao||'';
  const ed=document.getElementById('edit-data'); if(ed) ed.value=m.data||dataHoje();
  const sel=document.getElementById('edit-categoria');
  const cats=m.tipo==='ganho'?['Salário','Freelance','Investimento','Presente','Outros']:getCategoriasPorPerfil();
  const picker=document.getElementById('edit-categoria-picker');
  if(sel) sel.value=m.categoria||cats[0];
  if(picker){
    picker.innerHTML=cats.map(c=>{
      const png=getIconeCat(c);
      const ico=png?`<img src="${png}" alt="${c}">`:`<img src="icone-dinheiro-01.png" style="width:26px;height:26px;object-fit:contain;border-radius:50%">`;
      return `<div class="cat-picker-item${c===(m.categoria||cats[0])?' selected':''}" onclick="selecionarCategoriaPicker(this,'edit-categoria','edit-categoria-picker')" data-val="${c}">${ico}<span class="cat-pk-nome">${c}</span></div>`;
    }).join('');
  }
  const modalEditar=document.getElementById('modal-editar');
  console.log('[DEBUG] Modal editar encontrado:', modalEditar);
  if(modalEditar){
    modalEditar.classList.remove('hidden');
    modalEditar.style.display='flex';
    modalEditar.style.visibility='visible';
    modalEditar.style.pointerEvents='auto';
    modalEditar.style.opacity='1';
    console.log('[DEBUG] Modal deveria estar visível agora');
  } else {
    console.error('[DEBUG] Modal editar NÃO encontrado no DOM!');
  }
};
window.fecharModalEditar=function(){
  const modalEditar=document.getElementById('modal-editar');
  if(modalEditar){
    modalEditar.classList.add('hidden');
    modalEditar.style.display='none';
    modalEditar.style.visibility='hidden';
    modalEditar.style.pointerEvents='none';
  }
  movEditandoId=null;
};
window.salvarEdicao=async function(){
  if(!movEditandoId) return;
  const valor=parseFloat(document.getElementById('edit-valor').value);
  if(!valor||valor<=0){showToast('Informe um valor válido.','error');return;}
  const descricao=document.getElementById('edit-descricao').value.trim();
  const ed=document.getElementById('edit-data');
  const data=ed?ed.value:dataHoje();
  const categoria=document.getElementById('edit-categoria').value;
  try{await atualizarMovimentacao(uidAtual,movEditandoId,{valor,descricao,data,categoria});fecharModalEditar();}
  catch(e){showToast('Erro ao salvar.','error');console.error(e);}
};
window.excluirMovimentacao=function(){
  if(!movEditandoId) return;
  confirmarAcao('Excluir esta movimentação?', async ()=>{
    try{await deletarMovimentacao(uidAtual,movEditandoId);fecharModalEditar();}
    catch(e){showToast('Erro ao excluir.','error');console.error(e);}
  });
};

// ── Tabela ────────────────────────────────────────────────────────
window.setFiltro=function(filtro,btn){
  filtroAtual=filtro;
  document.querySelectorAll('.filtro-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  atualizarTelaCategorias();renderizarTabela();
};
function filtrarPorPeriodo(lista){
  const hoje=new Date(); hoje.setHours(23,59,59,999);
  return lista.filter(m=>{
    if(!m.data) return true;
    const d=new Date(m.data+'T00:00:00');
    if(filtroAtual==='semana'){
      const ini=new Date(hoje); ini.setDate(ini.getDate()-6); ini.setHours(0,0,0,0);
      return d>=ini&&d<=hoje;
    }
    if(filtroAtual==='mes') return d.getMonth()===hoje.getMonth()&&d.getFullYear()===hoje.getFullYear();
    if(filtroAtual==='3meses'){const lim=new Date(hoje);lim.setMonth(lim.getMonth()-3);lim.setHours(0,0,0,0);return d>=lim;}
    if(filtroAtual==='ano') return d.getFullYear()===hoje.getFullYear();
    return true; // tudo
  });
}

// Seletor de período
window.setPeriodo = function(periodo){
  filtroAtual = periodo;
  // Atualizar botões
  ['semana','mes','3meses','ano','tudo'].forEach(p=>{
    const btn=document.getElementById('periodo-btn-'+p);
    if(btn) btn.classList.toggle('active', p===periodo);
  });
  // Atualizar tudo
  atualizarKPIs();
  atualizarChart();
  renderizarListaInicio();
  renderizarTabela();
  atualizarTelaCategorias();
  calcularScore();
  // Atualizar subtítulo dos KPIs
  const labels={semana:'Esta semana',mes:'Este mês','3meses':'Últimos 3 meses',ano:'Este ano',tudo:'Todo período'};
  const lbl=labels[periodo]||'no período';
  const es=document.getElementById('kpi-entradas-sub');
  const ss=document.getElementById('kpi-saidas-sub');
  if(es) es.textContent=lbl;
  if(ss) ss.textContent=lbl;
};
function renderizarTabela(){
  const tbody=document.getElementById('tabela-gastos');
  const cEl=document.getElementById('table-count');
  if(!tbody) return;
  const filtradas=filtrarPorPeriodo(movimentacoes);
  if(cEl) cEl.textContent=`${filtradas.length} registros`;
  if(filtradas.length===0){tbody.innerHTML='<tr><td colspan="6" class="vazio">Nenhuma movimentação no período.</td></tr>';return;}
  tbody.innerHTML=filtradas.map(m=>`
    <tr>
      <td>${m.descricao||'—'}</td>
      <td>${fmtData(m.data)}</td>
      <td>${m.categoria||'—'}</td>
      <td><span class="badge ${m.tipo==='ganho'?'badge-green':'badge-red'}">${m.tipo==='ganho'?'Entrada':'Saída'}</span></td>
      <td class="${m.tipo==='ganho'?'green':'red'}">${m.tipo==='ganho'?'+':'-'}${fmt(m.valor)}</td>
      <td><button class="btn-icon" onclick="abrirModalEditar('${m.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></td>
    </tr>`).join('');
}
function atualizarTelaCategorias(){
  renderSugestaoOrcamento();
  const grid=document.getElementById('categorias-grid-dinamico'); if(!grid) return;
  const filtradas=filtrarPorPeriodo(movimentacoes).filter(m=>m.tipo==='gasto'&&naoEQuitacao(m));

  // Incluir todas as categorias do perfil (mesmo com R$0)
  const cats=getCategoriasPorPerfil();
  const porCat={};
  cats.forEach(c=>{porCat[c]=0;});
  filtradas.forEach(m=>{const c=m.categoria||'Outros';porCat[c]=(porCat[c]||0)+m.valor;});
  const total=Object.values(porCat).reduce((s,v)=>s+v,0);

  if(cats.length===0&&total===0){grid.innerHTML='<div class="vazio" style="grid-column:1/-1">Sem gastos no período.</div>';atualizarGraficoPizza({});return;}

  // Ordenar: com gasto primeiro, depois sem gasto
  const sorted=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);

  grid.innerHTML=sorted.map(([cat,val])=>{
    const pct=total>0?Math.round(val/total*100):0;
    const png=getIconeCat(cat);
    const iconeEl=png
      ? `<img src="${png}" alt="${cat}">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><circle cx="12" cy="12" r="10"/></svg>`;
    const barColor=pct>60?'var(--red)':pct>30?'var(--yellow)':'var(--primary)';
    return `<div class="cat-card" onclick="filtrarPorCategoria('${cat}')" style="cursor:pointer;position:relative;overflow:hidden">
      <div class="cat-icon">${iconeEl}</div>
      <div class="cat-nome">${cat}</div>
      <div class="cat-valor">${fmt(val)}</div>
      <div class="cat-meta-label">${pct}% do limite</div>
      <div class="cat-meta-bar"><div class="cat-meta-fill" style="width:${pct}%;background:${barColor}"></div></div>
    </div>`;
  }).join('');
  atualizarGraficoPizza(porCat);
}
const COLORS=['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#a855f7'];
function atualizarGraficoPizza(porCat){
  const canvas=document.getElementById('chart-pizza');
  const emptyEl=document.getElementById('pizza-empty');
  const legendaEl=document.getElementById('pizza-legenda');
  if(!canvas) return;
  const labels=Object.keys(porCat).filter(k=>porCat[k]>0);
  const data=labels.map(k=>porCat[k]);
  const total=data.reduce((a,b)=>a+b,0);
  if(total===0){canvas.style.display='none';if(emptyEl)emptyEl.style.display='flex';if(legendaEl)legendaEl.innerHTML='';return;}
  canvas.style.display='block';if(emptyEl)emptyEl.style.display='none';
  const cores=['#22C55E','#3B82F6','#F59E0B','#EF4444','#A855F7','#64748B','#EC4899','#14B8A6'];
  if(chartPizza){chartPizza.destroy();chartPizza=null;}
  const ctx=canvas.getContext('2d');
  const tipo=tipoGraficoPizza||'doughnut';

  if(tipo==='bar'){
    chartPizza=new Chart(ctx,{type:'bar',
      data:{labels,datasets:[{data,backgroundColor:cores.slice(0,labels.length),borderWidth:0,borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.raw)+' ('+((c.raw/total)*100).toFixed(0)+'%)'}}},
        scales:{
          x:{grid:{display:false},ticks:{color:'rgba(255,255,255,0.5)',font:{size:10}}},
          y:{grid:{color:'rgba(255,255,255,0.06)'},ticks:{color:'rgba(255,255,255,0.5)',font:{size:10},callback:v=>'R$'+v}}
        }
      }
    });
    if(legendaEl) legendaEl.innerHTML='';
  } else {
    chartPizza=new Chart(ctx,{type:'doughnut',
      data:{labels,datasets:[{data,backgroundColor:cores.slice(0,labels.length),borderWidth:0,hoverOffset:6}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{
          title:items=>items[0].label,
          label:c=>' '+c.label+': '+fmt(c.raw)+' ('+((c.raw/total)*100).toFixed(0)+'%)'
        }}},
        cutout:'60%'
      }
    });
    if(legendaEl){
      legendaEl.innerHTML=labels.map((l,i)=>`
        <div class="pizza-leg-item">
          <span style="width:10px;height:10px;border-radius:50%;background:${cores[i]};flex-shrink:0;display:inline-block"></span>
          <span style="font-size:.78rem;color:var(--gray)">${l}</span>
          <span style="font-size:.78rem;font-weight:600;color:var(--white);margin-left:auto">${((data[i]/total)*100).toFixed(0)}%</span>
        </div>`).join('');
    }
  }
}

function _matchQ(str, q) {
  return (str||'').toLowerCase().includes(q.toLowerCase());
}

function _buscarTudo(q) {
  if (!q.trim()) return [];
  const resultados = [];

  // 1. Movimentações
  movimentacoes.filter(m =>
    _matchQ(m.descricao, q) || _matchQ(m.categoria, q) || _matchQ(m.valor+'', q)
  ).slice(0, 5).forEach(m => {
    resultados.push({
      tipo: 'mov',
      icone: m.tipo === 'ganho' ? '↑' : '↓',
      iconeBg: m.tipo === 'ganho' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      iconeColor: m.tipo === 'ganho' ? '#22c55e' : '#ef4444',
      titulo: m.descricao || '—',
      sub: (m.categoria || '') + ' · ' + fmtData(m.data),
      valor: (m.tipo === 'ganho' ? '+' : '−') + fmt(m.valor),
      valorColor: m.tipo === 'ganho' ? '#22c55e' : '#ef4444',
      secao: 'Movimentações',
      acao: () => { irPara('gastos'); setTimeout(() => abrirModalEditar(m.id), 200); }
    });
  });

  // 2. Metas
  metas.filter(m =>
    _matchQ(m.nome, q) || _matchQ(m.valor+'', q)
  ).slice(0, 3).forEach(m => {
    const pct = m.valor > 0 ? Math.min(100, Math.round((m.atual||0)/m.valor*100)) : 0;
    resultados.push({
      tipo: 'meta',
      icone: 'icone-meta.png',
      iconeBg: 'rgba(139,92,246,0.15)',
      iconeColor: '#8b5cf6',
      titulo: m.nome || '—',
      sub: `Meta: ${fmt(m.valor)} · ${pct}% concluída`,
      valor: fmt(m.atual||0),
      valorColor: '#8b5cf6',
      secao: 'Metas',
      acao: () => irPara('metas')
    });
  });

  // 3. Dívidas
  dividas.filter(d =>
    _matchQ(d.descricao, q) || _matchQ(d.tipo, q) || _matchQ(d.valor+'', q)
  ).slice(0, 3).forEach(d => {
    resultados.push({
      tipo: 'divida',
      icone: 'icone-cartao-01.png',
      iconeBg: 'rgba(239,68,68,0.15)',
      iconeColor: '#ef4444',
      titulo: d.descricao || '—',
      sub: `Dívida · ${d.tipo||''}`,
      valor: fmt(d.valor||0),
      valorColor: '#ef4444',
      secao: 'Dívidas',
      acao: () => irPara('dividas')
    });
  });

  // 4. Contas a pagar
  contas.filter(c =>
    _matchQ(c.descricao, q) || _matchQ(c.categoria, q) || _matchQ(c.valor+'', q)
  ).slice(0, 3).forEach(c => {
    const status = c.paga ? '✓ Paga' : 'Pendente';
    resultados.push({
      tipo: 'conta',
      icone: '📅',
      iconeBg: 'rgba(245,158,11,0.15)',
      iconeColor: '#f59e0b',
      titulo: c.descricao || '—',
      sub: `${c.categoria||''} · Vence ${fmtData(c.vencimento)} · ${status}`,
      valor: fmt(c.valor||0),
      valorColor: c.paga ? '#22c55e' : '#f59e0b',
      secao: 'Contas a Pagar',
      acao: () => irPara('contas')
    });
  });

  // 5. Navegação rápida por palavras-chave
  const navMap = [
    {keys:['investimento','bolsa','ação','fii','etf','cripto','bitcoin','selic','cdi'], tela:'investimentos', label:'Ir para Investimentos'},
    {keys:['score','pontu','classificaç'], tela:'score', label:'Ir para Score Financeiro'},
    {keys:['relatório','histórico','mês anterior'], tela:'relatorio', label:'Ir para Relatório'},
    {keys:['aprender','artigo','reserva','educaç'], tela:'aprender', label:'Ir para Aprender'},
  ];
  navMap.forEach(nav => {
    if(nav.keys.some(k => _matchQ(q, k) || _matchQ(k, q))) {
      resultados.push({
        tipo: 'nav',
        icone: '→',
        iconeBg: 'rgba(34,197,94,0.1)',
        iconeColor: '#22c55e',
        titulo: nav.label,
        sub: 'Atalho de navegação',
        valor: '',
        valorColor: '',
        secao: 'Navegação',
        acao: () => irPara(nav.tela)
      });
    }
  });

  return resultados;
}

// Agrupa resultados por seção
function _renderDropdown(q) {
  const dd = document.getElementById('search-dropdown');
  const hd = document.getElementById('search-results-header');
  const lst = document.getElementById('search-results-list');
  if (!dd) return;

  if (!q.trim()) { dd.style.display = 'none'; return; }

  const res = _buscarTudo(q);
  if (hd) hd.innerHTML = res.length > 0
    ? `<span style="color:var(--gray)">${res.length} resultado${res.length>1?'s':''} para </span><strong style="color:var(--white)">"${q}"</strong>`
    : `<span style="color:var(--gray)">Nenhum resultado para </span><strong style="color:var(--white)">"${q}"</strong>`;

  if (res.length === 0) {
    if (lst) lst.innerHTML = `<div style="padding:20px;text-align:center">
      <div style="font-size:1.8rem;margin-bottom:8px">🔍</div>
      <div style="font-size:.85rem;color:var(--gray)">Tente buscar por descrição,<br>categoria ou valor</div>
    </div>`;
    dd.style.display = 'block'; return;
  }

  // Agrupar por seção
  const secoes = {};
  res.forEach((r, idx) => {
    if (!secoes[r.secao]) secoes[r.secao] = [];
    secoes[r.secao].push({...r, idx});
  });

  let html = '';
  Object.entries(secoes).forEach(([secao, items]) => {
    html += `<div style="padding:6px 14px 2px;font-size:.68rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--gray)">${secao}</div>`;
    items.forEach(r => {
      html += `<div id="sr-${r.idx}" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);transition:background .12s"
        onmouseenter="this.style.background='rgba(255,255,255,0.05)'"
        onmouseleave="this.style.background=''"
        onclick="_executarBusca(${r.idx})">
        <div style="width:34px;height:34px;border-radius:10px;background:${r.iconeBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${r.iconeColor};font-size:.9rem;font-weight:700">${r.icone}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.86rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--white)">${r.titulo}</div>
          <div style="font-size:.72rem;color:var(--gray);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.sub}</div>
        </div>
        ${r.valor ? `<div style="font-size:.86rem;font-weight:700;color:${r.valorColor};flex-shrink:0">${r.valor}</div>` : ''}
      </div>`;
    });
  });

  if (lst) lst.innerHTML = html;
  dd.style.display = 'block';

  // Guardar ações para execução
  window._buscaAcoes = res.map(r => r.acao);
}

window._executarBusca = function(idx) {
  esconderDropdown();
  window.limparBusca();
  if (window._buscaAcoes && window._buscaAcoes[idx]) {
    window._buscaAcoes[idx]();
  }
};

window.buscarMovimentacoes = function(q) {
  const c = document.getElementById('search-clear');
  const cm = document.getElementById('search-clear-mobile');
  if (c) c.style.display = q ? 'block' : 'none';
  if (cm) cm.style.display = q ? 'block' : 'none';
  _renderDropdown(q);
};

window.mostrarDropdownBusca = function(q) { _renderDropdown(q); };

function esconderDropdown() {
  const dd = document.getElementById('search-dropdown');
  if (dd) dd.style.display = 'none';
}
window.fecharDropdownBusca = esconderDropdown;

window.limparBusca = function() {
  const si = document.getElementById('search-input');
  const sm = document.getElementById('search-input-mobile');
  if (si) si.value = ''; if (sm) sm.value = '';
  esconderDropdown();
  const c = document.getElementById('search-clear');
  const cm = document.getElementById('search-clear-mobile');
  if (c) c.style.display = 'none';
  if (cm) cm.style.display = 'none';
};

document.addEventListener('click', e => {
  if (!e.target.closest('#search-dropdown') && !e.target.closest('.search-bar') && !e.target.closest('.search-mobile-overlay'))
    esconderDropdown();
});

// Fechar dropdown ao pressionar Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { esconderDropdown(); window.limparBusca(); }
});

window.abrirBuscaMobile = function() {
  const o = document.getElementById('search-mobile-overlay');
  if (o) { o.style.display = 'flex'; const si = document.getElementById('search-input-mobile'); if (si) si.focus(); }
};
window.fecharBuscaMobile = function() {
  const o = document.getElementById('search-mobile-overlay');
  if (o) o.style.display = 'none';
  window.limparBusca();
};

// ── Metas ─────────────────────────────────────────────────────────
window.criarMeta=async function(){
  const nome=document.getElementById('meta-nome').value.trim();
  const valor=parseBR(document.getElementById('meta-valor').value);
  const atual=parseBR(document.getElementById('meta-atual').value)||0;
  const dataAlvoRaw=document.getElementById('meta-data-alvo').value;
  const dataAlvo = dataAlvoRaw && dataAlvoRaw !== '' && dataAlvoRaw !== 'undefined' ? dataAlvoRaw : null;
  if(!nome){showToast('Preencha o nome da meta.','error');return;}
  if(!valor||isNaN(valor)||valor<=0){showToast('Preencha o valor objetivo da meta.','error');return;}
  if(atual>valor){showToast('O valor já guardado não pode ser maior que o objetivo.','error');return;}
  try{
    await adicionarMeta(uidAtual,{nome,valor:valor,atual:atual,dataAlvo:dataAlvo});
    ['meta-nome','meta-valor','meta-atual','meta-data-alvo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    metas=await getMetas(uidAtual);renderizarMetas();
  }catch(e){showToast('Erro ao criar meta.','error');console.error(e);}
};
function renderizarMetas(){
  const el=document.getElementById('lista-metas'); if(!el) return;
  if(metas.length===0){el.innerHTML='<div class="vazio">Nenhuma meta ainda.</div>';return;}
  el.innerHTML=metas.map(m=>{
    const atual = parseFloat(m.atual)||0;
    const valor = parseFloat(m.valor)||0;
    const pct = valor>0 ? Math.min(100,(atual/valor)*100) : 0;
    const faltam = Math.max(0, valor-atual);
    const prazoOk = m.dataAlvo && m.dataAlvo!=='' && m.dataAlvo!=='undefined' && m.dataAlvo!=='null' && m.dataAlvo!==null;
    return `<div class="meta-card"><div class="meta-header"><span class="meta-nome">${m.nome}</span><span class="meta-pct">${pct.toFixed(0)}%</span></div><div class="meta-bar-wrap"><div class="meta-bar" style="width:${pct}%"></div></div><div class="meta-valores"><span class="green">${fmt(atual)} guardados</span><span class="gray">Faltam ${fmt(faltam)}</span></div>${prazoOk?`<div style="font-size:.75rem;color:var(--gray);margin-top:4px;display:flex;align-items:center;gap:4px"><img src="icone-meta.png" style="width:14px;height:14px;object-fit:contain"> Prazo: ${fmtData(m.dataAlvo)}</div>`:''}<div style="display:flex;gap:8px;margin-top:10px"><button class="btn-sm-green" onclick="abrirModalMeta('${m.id}')">+ Adicionar</button><button class="btn-sm-red" onclick="excluirMeta('${m.id}')">Excluir</button></div></div>`;
  }).join('');
}
window.abrirModalMeta=function(id){
  metaEditandoId=id;
  const m=metas.find(x=>x.id===id); if(!m) return;
  document.getElementById('modal-meta-nome-display').textContent=m.nome;
  const atual=parseFloat(m.atual)||0;
  const valor=parseFloat(m.valor)||0;
  const pct=valor>0?Math.min(100,Math.round((atual/valor)*100)):0;
  const prog=document.getElementById('modal-meta-progresso-display');
  if(prog) prog.textContent=`${fmt(atual)} de ${fmt(valor)} guardados (${pct}%)`;
  document.getElementById('modal-meta-valor').value='';
  document.getElementById('modal-meta').classList.remove('hidden');
};
window.abrirModalMetaPorId=window.abrirModalMeta;
window.fecharModalMeta=function(){document.getElementById('modal-meta').classList.add('hidden');metaEditandoId=null;};
window.adicionarValorMeta=async function(){
  if(!metaEditandoId) return;
  const val=parseBR(document.getElementById('modal-meta-valor').value);
  if(!val||val<=0){showToast('Informe um valor válido.','error');return;}
  const m=metas.find(x=>x.id===metaEditandoId); if(!m) return;
  const novoAtual = (parseFloat(m.atual)||0) + val;
  const valorObjetivo = parseFloat(m.valor)||0;
  if(valorObjetivo > 0 && novoAtual > valorObjetivo){
    showToast(`Valor excede o objetivo de ${fmt(valorObjetivo)}. Máximo: ${fmt(valorObjetivo - (parseFloat(m.atual)||0))}`, 'error');
    return;
  }
  try{await atualizarMeta(uidAtual,metaEditandoId,{atual:novoAtual});metas=await getMetas(uidAtual);renderizarMetas();fecharModalMeta();}
  catch(e){showToast('Erro ao atualizar meta.','error');console.error(e);}
};
window.excluirMeta=function(id){
  confirmarAcao('Excluir esta meta?', async ()=>{
    try{await deletarMeta(uidAtual,id);metas=await getMetas(uidAtual);renderizarMetas();}
    catch(e){showToast('Erro ao excluir.','error');console.error(e);}
  });
};

// ── Dívidas ───────────────────────────────────────────────────────
window.atualizarFormDivida=function(){
  const tipo=document.getElementById('div-tipo').value;
  const ta=document.getElementById('div-terceiro-area');
  if(ta) ta.style.display=tipo==='terceiros'?'block':'none';
};
window.cadastrarDivida=async function(){
  const tipo=document.getElementById('div-tipo').value;
  const descricao=document.getElementById('div-descricao').value.trim();
  const valor=parseFloat(document.getElementById('div-valor').value);
  const juros=parseFloat(document.getElementById('div-juros').value)||0;
  const parcelas=parseInt(document.getElementById('div-parcelas').value)||0;
  const credor=document.getElementById('div-credor').value.trim();
  if(!descricao||!valor||valor<=0){showToast('Preencha descrição e valor.','error');return;}
  try{
    await adicionarDivida(uidAtual,{tipo,descricao,valor,juros,parcelas,credor});
    ['div-descricao','div-valor','div-juros','div-parcelas','div-credor'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const suc=document.getElementById('div-form-sucesso');
    if(suc){suc.style.display='block';setTimeout(()=>suc.style.display='none',2000);}
    dividas=await getDividas(uidAtual);renderizarDividas();
  }catch(e){showToast('Erro ao cadastrar dívida.','error');console.error(e);}
};
function renderizarDividas(){
  const el=document.getElementById('lista-dividas-cadastradas'); if(!el) return;
  const lbl={cartao:'Cartão de crédito',emprestimo:'Empréstimo',financiamento:'Financiamento',terceiros:'Terceiros',outros:'Outros'};

  // Separar ativas e quitadas
  const ativas  = dividas.filter(d=>d.status!=='quitada');
  const quitadas= dividas.filter(d=>d.status==='quitada');

  // KPIs — só dívidas ativas
  const tot =ativas.reduce((s,d)=>s+(d.valor||0),0);
  const cart=ativas.filter(d=>d.tipo==='cartao').reduce((s,d)=>s+(d.valor||0),0);
  const emp =ativas.filter(d=>d.tipo==='emprestimo'||d.tipo==='financiamento').reduce((s,d)=>s+(d.valor||0),0);
  const terc=ativas.filter(d=>d.tipo==='terceiros').reduce((s,d)=>s+(d.valor||0),0);
  const kT=document.getElementById('div-kpi-total');const kQ=document.getElementById('div-kpi-qtd');
  const kC=document.getElementById('div-kpi-cartao');const kE=document.getElementById('div-kpi-emprest');const kTe=document.getElementById('div-kpi-terceiros');
  if(kT)kT.textContent=fmt(tot);
  if(kQ)kQ.textContent=ativas.length>0?`${ativas.length} dívida(s) ativa(s)`:'Nenhuma dívida ativa';
  if(kC)kC.textContent=fmt(cart);if(kE)kE.textContent=fmt(emp);if(kTe)kTe.textContent=fmt(terc);

  // Lista de dívidas ativas
  if(ativas.length===0){
    el.innerHTML='<div class="vazio">Nenhuma dívida ativa.<br><span style="font-size:.8rem">Use o formulário ao lado para registrar.</span></div>';
  } else {
    el.innerHTML=ativas.map(d=>`
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div><div style="font-weight:700">${d.descricao}</div><div style="font-size:.75rem;color:var(--gray)">${lbl[d.tipo]||d.tipo}${d.credor?' · '+d.credor:''}</div></div>
          <div style="text-align:right"><div style="font-weight:800;color:#ef4444">${fmt(d.valor)}</div>${d.juros>0?`<div style="font-size:.72rem;color:var(--gray)">${d.juros}% a.m.</div>`:''}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-sm-green" data-acao="quitar" data-id="${d.id}">✓ Quitar</button>
          <button class="btn-sm-red"   data-acao="excluir" data-id="${d.id}">Excluir</button>
        </div>
      </div>`).join('');
  }

  // Event delegation
  el.onclick=function(e){
    const btn=e.target.closest('button[data-acao]');
    if(!btn) return;
    e.stopPropagation();
    const id=btn.getAttribute('data-id');
    const acao=btn.getAttribute('data-acao');
    if(acao==='quitar')  window.quitarDivida(id);
    if(acao==='excluir') window.excluirDivida(id);
  };

  // Histórico de dívidas quitadas
  let hist=document.getElementById('historico-dividas-section');
  if(!hist){
    hist=document.createElement('div');
    hist.id='historico-dividas-section';
    hist.style.marginTop='24px';
    el.parentNode.appendChild(hist);
  }
  if(quitadas.length===0){
    hist.innerHTML='';
  } else {
    hist.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <img src="icone-trofeu.png" style="width:20px;height:20px;object-fit:contain">
        <span style="font-weight:700;font-size:.9rem;color:var(--white)">Dívidas quitadas</span>
        <span style="font-size:.78rem;color:var(--gray)">${quitadas.length} liquidada(s)</span>
      </div>
      ${quitadas.map(d=>`
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-weight:600;color:var(--white)">${d.descricao}</div>
            <div style="font-size:.75rem;color:var(--gray)">${lbl[d.tipo]||d.tipo} · Quitada em ${d.quitadaEm?fmtData(d.quitadaEm):'—'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:#22c55e">${fmt(d.valor)}</div>
            <button class="btn-sm-red" style="margin-top:6px;font-size:.72rem" data-acao="excluir" data-id="${d.id}">Excluir</button>
          </div>
        </div>`).join('')}`;
    // Event delegation no histórico também
    hist.onclick=function(e){
      const btn=e.target.closest('button[data-acao]');
      if(!btn) return;
      e.stopPropagation();
      window.excluirDivida(btn.getAttribute('data-id'));
    };
  }

  // Estratégia — só para dívidas ativas
  const eCard=document.getElementById('estrategia-card');const eTex=document.getElementById('estrategia-texto');
  if(eCard&&eTex){
    if(ativas.length===0){eCard.style.display='none';}
    else{eCard.style.display='block';const mj=[...ativas].sort((a,b)=>(b.juros||0)-(a.juros||0))[0];eTex.innerHTML=mj&&mj.juros>0?`Priorize quitar <strong>${mj.descricao}</strong> — tem os maiores juros (${mj.juros}% a.m.). Método avalanche economiza mais a longo prazo.`:'Use o método bola de neve: quite as menores dívidas primeiro.';}
  }
}
// Modal de confirmação customizado (evita bloqueio do confirm() nativo no mobile)
function confirmarAcao(msg, onConfirm) {
  // Remove overlay anterior se existir
  const existing = document.getElementById('confirm-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'confirm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface,#111827);border:1px solid var(--border,#1e293b);border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center';

  const txtEl = document.createElement('p');
  txtEl.style.cssText = 'color:var(--white,#fff);font-size:.95rem;margin-bottom:20px;line-height:1.5';
  txtEl.textContent = msg;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;justify-content:center';

  const btnNo = document.createElement('button');
  btnNo.textContent = 'Cancelar';
  btnNo.style.cssText = 'flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;font-size:.9rem;cursor:pointer;font-family:inherit';

  const btnYes = document.createElement('button');
  btnYes.textContent = 'Confirmar';
  btnYes.style.cssText = 'flex:1;padding:12px;border-radius:10px;border:none;background:#22c55e;color:#000;font-weight:700;font-size:.9rem;cursor:pointer;font-family:inherit';

  const close = () => overlay.remove();

  btnYes.addEventListener('click', (e) => { e.stopPropagation(); close(); onConfirm(); });
  btnNo.addEventListener('click',  (e) => { e.stopPropagation(); close(); });
  overlay.addEventListener('click', (e) => { if(e.target===overlay) close(); });

  row.appendChild(btnNo);
  row.appendChild(btnYes);
  box.appendChild(txtEl);
  box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

window.quitarDivida=function(id){
  const sid=String(id);
  const divida=dividas.find(d=>String(d.id)===sid);
  if(!divida){showToast('Dívida não encontrada.','error');return;}
  confirmarAcao(`Quitar "${divida.descricao}" (${fmt(divida.valor)})?`, async ()=>{
    if(!uidAtual){showToast('Sessão expirada. Recarregue a página.','error');return;}
    try{
      const scoreAntes=calcularScoreValor();
      const hoje=new Date().toISOString().split('T')[0];
      // Marca como quitada no Firestore (não deleta — mantém histórico)
      await atualizarDivida(uidAtual, sid, {
        status: 'quitada',
        quitadaEm: hoje
      });
      // Atualiza array local imediatamente
      dividas=await getDividas(uidAtual);
      renderizarDividas();
      atualizarKPIs();
      calcularScore();
      // Feedback de pontos
      const scoreDepois=calcularScoreValor();
      mostrarToastScore(scoreDepois-scoreAntes, divida.descricao);
    }catch(e){
      console.error('[quitarDivida]',e);
      showToast('Erro ao quitar: '+e.message,'error');
    }
  });
};
window.excluirDivida=function(id){
  const sid=String(id);
  confirmarAcao('Excluir esta dívida permanentemente?', async ()=>{
    if(!uidAtual){showToast('Sessão expirada. Recarregue a página.','error');return;}
    try{
      await deletarDivida(uidAtual,sid);
      dividas=await getDividas(uidAtual);
      renderizarDividas();
    }catch(e){
      console.error('[excluirDivida]',e);
      showToast('Erro ao excluir: '+e.message,'error');
    }
  });
};
window.calcularDivida=function(){
  const valor=parseFloat(document.getElementById('sim-valor').value);
  const juros=parseFloat(document.getElementById('sim-juros').value);
  const parc=parseInt(document.getElementById('sim-parcelas').value);
  if(!valor||!juros||!parc){showToast('Preencha todos os campos do simulador.','error');return;}
  const taxa=juros/100;
  const parcela=valor*(taxa*Math.pow(1+taxa,parc))/(Math.pow(1+taxa,parc)-1);
  const totalPagar=parcela*parc;const totalJuros=totalPagar-valor;
  const dOrig=document.getElementById('div-original');const dJT=document.getElementById('div-juros-total');
  const dTot=document.getElementById('div-total');const dPar=document.getElementById('div-parcela');
  if(dOrig)dOrig.textContent=fmt(valor);if(dJT)dJT.textContent=fmt(totalJuros);
  if(dTot)dTot.textContent=fmt(totalPagar);if(dPar)dPar.textContent=fmt(parcela);
  const al=document.getElementById('div-alerta');if(al) al.innerHTML=totalJuros/valor>0.5?'⚠️ Os juros representam mais de 50% do valor original!':'';
  document.getElementById('resultado-divida').classList.remove('hidden');
};

// ── Contas ────────────────────────────────────────────────────────
window.salvarConta=async function(){
  const descricao=document.getElementById('conta-descricao').value.trim();
  const valor=parseFloat(document.getElementById('conta-valor').value);
  const vencimento=document.getElementById('conta-vencimento').value;
  const categoria=document.getElementById('conta-categoria').value;
  const recorrente=document.getElementById('conta-recorrente').checked;
  if(!descricao||!valor||!vencimento){showToast('Preencha descrição, valor e vencimento.','error');return;}
  try{
    if(contaEditandoId){
      await atualizarConta(uidAtual,contaEditandoId,{descricao,valor,vencimento,categoria,recorrente,paga:false});
      contaEditandoId=null;
      document.getElementById('contas-form-titulo').textContent='Nova Conta';
      document.getElementById('btn-salvar-conta').textContent='Cadastrar conta';
      document.getElementById('btn-cancelar-conta').style.display='none';
    }else{await adicionarConta(uidAtual,{descricao,valor,vencimento,categoria,recorrente,paga:false});}
    ['conta-descricao','conta-valor','conta-vencimento'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('conta-recorrente').checked=false;
    const suc=document.getElementById('conta-sucesso');if(suc){suc.style.display='block';setTimeout(()=>suc.style.display='none',2000);}
    contas=await getContas(uidAtual);renderizarContas();
  }catch(e){showToast('Erro ao salvar conta.','error');console.error(e);}
};
window.editarConta=function(id){
  const c=contas.find(x=>x.id===id); if(!c) return;
  contaEditandoId=id;
  document.getElementById('conta-descricao').value=c.descricao;
  document.getElementById('conta-valor').value=c.valor;
  document.getElementById('conta-vencimento').value=c.vencimento;
  document.getElementById('conta-categoria').value=c.categoria||'Outros';
  document.getElementById('conta-recorrente').checked=c.recorrente||false;
  document.getElementById('contas-form-titulo').textContent='Editar Conta';
  document.getElementById('btn-salvar-conta').textContent='Salvar alterações';
  document.getElementById('btn-cancelar-conta').style.display='block';
};
window.cancelarEdicaoConta=function(){
  contaEditandoId=null;
  ['conta-descricao','conta-valor','conta-vencimento'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('contas-form-titulo').textContent='Nova Conta';
  document.getElementById('btn-salvar-conta').textContent='Cadastrar conta';
  document.getElementById('btn-cancelar-conta').style.display='none';
};
window.pagarConta=async function(id){
  try{
    await atualizarConta(uidAtual,id,{paga:true});
    contas=await getContas(uidAtual);
    renderizarContas();
    // Limpar lembrete fechado
    localStorage.removeItem(`lembrete_${id}_fechado`);
    renderizarLembretesFaturas();
  }
  catch(e){showToast('Erro ao pagar conta.','error');console.error(e);}
};
window.excluirConta=function(id){
  confirmarAcao('Excluir esta conta?', async ()=>{
    try{await deletarConta(uidAtual,id);contas=await getContas(uidAtual);renderizarContas();}
    catch(e){showToast('Erro ao excluir conta.','error');console.error(e);}
  });
};
window.filtrarContas=function(filtro,btn){
  filtroContasAtual=filtro;
  document.querySelectorAll('.contas-filtro-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderizarContas();
};
window.mudarMesContas=function(delta){mesContas=new Date(mesContas.getFullYear(),mesContas.getMonth()+delta,1);renderizarContas();};
window.renderizarContas=renderizarContas;

// Popular select de categoria de contas com categorias do perfil
function popularSelectContas(){
  const sel=document.getElementById('conta-categoria'); if(!sel) return;
  // Reusar a mesma lógica do getCategoriasPorPerfil para consistência
  const cats=getCategoriasPorPerfil();
  const extras=[];
  // Bloco vazio para manter estrutura do código abaixo
  [].forEach(r=>{});
  [].filter(r=>false).forEach(r=>{
    const n=r.trim(); if(!extras.includes(n)) extras.push(n);
  });
  const todas=[...cats,...extras.filter(e=>!cats.includes(e))];
  const cur=sel.value;
  sel.innerHTML=todas.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(cur && todas.includes(cur)) sel.value=cur;
}

async function renovarContasRecorrentes(){
  if(!uidAtual||contas.length===0) return;
  const hoje=new Date();
  const anoMesAtual=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const contasRecorrentes=contas.filter(c=>c.recorrente&&c.paga&&!c.vencimento.startsWith(anoMesAtual));

  for(const conta of contasRecorrentes){
    const diaVenc=conta.vencimento.split('-')[2];
    const novoVenc=`${anoMesAtual}-${diaVenc}`;

    // Verifica se já existe uma conta para o mês atual com mesma descrição
    const jaExiste=contas.some(c=>
      c.descricao===conta.descricao&&
      c.vencimento.startsWith(anoMesAtual)
    );

    if(!jaExiste){
      await adicionarConta(uidAtual,{
        descricao:conta.descricao,
        valor:conta.valor,
        vencimento:novoVenc,
        categoria:conta.categoria||'Outros',
        recorrente:true,
        paga:false,
        tipo:conta.tipo||'pagar'
      });
    }
  }

  // Recarregar contas se houve alteração
  if(contasRecorrentes.length>0){
    contas=await getContas(uidAtual);
  }
}

// ── Cartões ───────────────────────────────────────────────────────
window.salvarCartao=async function(){
  if(!uidAtual) return;
  const nome=document.getElementById('cartao-nome').value.trim();
  const corte=parseInt(document.getElementById('cartao-corte').value);
  const vencimento=parseInt(document.getElementById('cartao-vencimento').value);
  const limite=parseFloat(document.getElementById('cartao-limite').value)||0;

  if(!nome){showToast('Digite o nome do cartão','error');return;}
  if(!corte||corte<1||corte>31){showToast('Dia do corte inválido','error');return;}
  if(!vencimento||vencimento<1||vencimento>31){showToast('Dia do vencimento inválido','error');return;}

  try{
    await adicionarCartao(uidAtual,{nome,diaCorte:corte,diaVencimento:vencimento,limite});
    cartoes=await getCartoes(uidAtual);
    renderizarCartoes();
    sincronizarFaturasComContas();
    document.getElementById('cartao-nome').value='';
    document.getElementById('cartao-corte').value='';
    document.getElementById('cartao-vencimento').value='';
    document.getElementById('cartao-limite').value='';
    showToast('Cartão adicionado!','success');
  }catch(e){
    showToast('Erro ao salvar cartão','error');
    console.error(e);
  }
};

window.editarCartao=async function(id){
  const cartao=cartoes.find(c=>c.id===id);
  if(!cartao) return;
  document.getElementById('cartao-nome').value=cartao.nome;
  document.getElementById('cartao-corte').value=cartao.diaCorte;
  document.getElementById('cartao-vencimento').value=cartao.diaVencimento;
  document.getElementById('cartao-limite').value=cartao.limite||'';
  await excluirCartao(id);
};

window.excluirCartao=async function(id){
  if(!uidAtual) return;
  confirmarAcao('Excluir este cartão?',async()=>{
    try{
      await deletarCartao(uidAtual,id);
      cartoes=await getCartoes(uidAtual);
      renderizarCartoes();
      sincronizarFaturasComContas();
      showToast('Cartão removido','success');
    }catch(e){
      showToast('Erro ao excluir','error');
      console.error(e);
    }
  });
};

function renderizarLembretesFaturas(){
  const container=document.getElementById('lembretes-faturas-container');
  if(!container) return;

  const hoje=new Date();
  hoje.setHours(0,0,0,0);

  // Buscar faturas pendentes de cartão
  const faturasPendentes=contas.filter(c=>
    !c.paga&&
    c.categoria==='Cartão de Crédito'&&
    c.vencimento
  );

  if(faturasPendentes.length===0){
    container.innerHTML='';
    return;
  }

  const lembretes=[];

  faturasPendentes.forEach(fatura=>{
    const dataVenc=new Date(fatura.vencimento+'T00:00:00');
    const diffDias=Math.ceil((dataVenc-hoje)/(1000*60*60*24));

    let tipo='';
    let cor='';
    let bg='';
    let border='';
    let mensagem='';
    let piscante=false;

    if(diffDias===0){
      tipo='hoje';
      cor='#ef4444';
      bg='rgba(239,68,68,0.15)';
      border='rgba(239,68,68,0.4)';
      mensagem=`Fatura vence HOJE!`;
      piscante=true;
    }else if(diffDias===1){
      tipo='1dia';
      cor='#ef4444';
      bg='rgba(239,68,68,0.12)';
      border='rgba(239,68,68,0.35)';
      mensagem=`Fatura vence amanhã`;
    }else if(diffDias===3){
      tipo='3dias';
      cor='#f97316';
      bg='rgba(249,115,22,0.12)';
      border='rgba(249,115,22,0.3)';
      mensagem=`Fatura vence em 3 dias`;
    }else if(diffDias===7){
      tipo='7dias';
      cor='#f59e0b';
      bg='rgba(245,158,11,0.1)';
      border='rgba(245,158,11,0.25)';
      mensagem=`Fatura vence em 7 dias`;
    }

    if(tipo){
      // Verificar se foi fechado (localStorage)
      const keyFechado=`lembrete_${fatura.id}_fechado`;
      const jaFechado=localStorage.getItem(keyFechado);
      if(!jaFechado){
        lembretes.push({tipo,cor,bg,border,mensagem,piscante,fatura});
      }
    }
  });

  if(lembretes.length===0){
    container.innerHTML='';
    return;
  }

  container.innerHTML=lembretes.map(l=>{
    const animacao=l.piscante?`@keyframes pulsar{0%,100%{opacity:1}50%{opacity:0.7}}`:'';
    return `<style>${animacao}</style><div style="position:relative;padding:14px 16px;background:${l.bg};border:1px solid ${l.border};border-radius:14px;margin-bottom:12px;${l.piscante?'animation:pulsar 1.5s ease-in-out infinite;':''}">
      <button onclick="fecharLembrete('${l.fatura.id}')" style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--gray);font-size:1.2rem;cursor:pointer;line-height:1;padding:4px">×</button>
      <div style="display:flex;align-items:center;gap:12px">
        <svg viewBox="0 0 24 24" fill="none" stroke="${l.cor}" stroke-width="2" style="width:24px;height:24px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="flex:1">
          <div style="font-size:.88rem;font-weight:700;color:${l.cor};margin-bottom:2px">${l.mensagem}</div>
          <div style="font-size:.78rem;color:var(--gray)">${l.fatura.descricao} — Total: <strong style="color:var(--white)">${fmt(l.fatura.valor)}</strong></div>
        </div>
        <button onclick="irParaCompromissos()" style="background:${l.cor};color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap">Ver fatura</button>
      </div>
    </div>`;
  }).join('');
}

window.fecharLembrete=function(faturaId){
  localStorage.setItem(`lembrete_${faturaId}_fechado`,'1');
  renderizarLembretesFaturas();
};

window.irParaCompromissos=function(){
  navegar('compromissos');
  setTimeout(()=>{
    if(typeof setSubTab==='function') setSubTab('contas');
  },100);
};

async function sincronizarFaturasComContas(){
  if(!uidAtual||cartoes.length===0) return;

  const hoje=new Date();

  for(const cartao of cartoes){
    // Calcular fatura vigente
    const diaHoje=hoje.getDate();
    let faturaVigente,anoFat,mesFat;
    if(diaHoje>cartao.diaCorte){
      const proxMes=hoje.getMonth()===11?1:hoje.getMonth()+2;
      const proxAno=hoje.getMonth()===11?hoje.getFullYear()+1:hoje.getFullYear();
      faturaVigente=`${proxAno}-${String(proxMes).padStart(2,'0')}`;
      anoFat=proxAno;
      mesFat=proxMes;
    }else{
      faturaVigente=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
      anoFat=hoje.getFullYear();
      mesFat=hoje.getMonth()+1;
    }

    // Somar gastos
    const gastosCartao=movimentacoes.filter(m=>
      m.tipo==='gasto'&&
      m.metodoPagamento==='cartao'&&
      m.fatura===faturaVigente&&
      m.cartao&&m.cartao.nome===cartao.nome
    );
    const totalFatura=gastosCartao.reduce((s,g)=>s+(g.valor||0),0);

    if(totalFatura===0) continue;

    // Nome da fatura
    const mesesNome=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const nomeFatura=`Fatura ${cartao.nome} - ${mesesNome[mesFat-1]}`;

    // Data de vencimento
    const dataVencimento=`${anoFat}-${String(mesFat).padStart(2,'0')}-${String(cartao.diaVencimento).padStart(2,'0')}`;

    // Verificar se já existe
    const contaExistente=contas.find(c=>c.descricao===nomeFatura&&!c.paga);

    if(contaExistente){
      // Atualizar valor se mudou
      if(contaExistente.valor!==totalFatura){
        await atualizarConta(uidAtual,contaExistente.id,{valor:totalFatura});
      }
    }else{
      // Criar nova conta
      await adicionarConta(uidAtual,{
        descricao:nomeFatura,
        valor:totalFatura,
        vencimento:dataVencimento,
        categoria:'Cartão de Crédito',
        paga:false,
        recorrente:false,
        cartaoId:cartao.id
      });
    }
  }

  // Recarregar contas
  contas=await getContas(uidAtual);
  renderizarContas();
  renderizarLembretesFaturas();
}

function renderizarCartoes(){
  const el=document.getElementById('lista-cartoes');
  if(!el) return;

  if(cartoes.length===0){
    el.innerHTML='';
    return;
  }

  // Calcular fatura atual para cada cartão
  const hoje=new Date();
  const anoMesAtual=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

  el.innerHTML=cartoes.map(c=>{
    // Calcular fatura vigente
    const diaHoje=hoje.getDate();
    let faturaVigente;
    if(diaHoje>c.diaCorte){
      // Depois do corte = próximo mês
      const proxMes=hoje.getMonth()===11?1:hoje.getMonth()+2;
      const proxAno=hoje.getMonth()===11?hoje.getFullYear()+1:hoje.getFullYear();
      faturaVigente=`${proxAno}-${String(proxMes).padStart(2,'0')}`;
    }else{
      faturaVigente=anoMesAtual;
    }

    // Somar gastos da fatura vigente desse cartão
    const gastosCartao=movimentacoes.filter(m=>
      m.tipo==='gasto'&&
      m.metodoPagamento==='cartao'&&
      m.fatura===faturaVigente&&
      m.cartao&&m.cartao.nome===c.nome
    );
    const totalFatura=gastosCartao.reduce((s,g)=>s+(g.valor||0),0);

    // Data de vencimento
    const [anoFat,mesFat]=faturaVigente.split('-');
    const dataVenc=`${c.diaVencimento}/${mesFat}/${anoFat}`;

    // Limite e percentual
    const limite=c.limite||0;
    const percentual=limite>0?Math.min(100,(totalFatura/limite)*100):0;
    let corBarra='#27ae60';
    if(percentual>90)corBarra='#ef4444';
    else if(percentual>70)corBarra='#f59e0b';

    // Histórico últimas 3 faturas pagas
    const faturasHistorico=contas.filter(ct=>
      ct.descricao&&ct.descricao.startsWith('Fatura '+c.nome)&&ct.paga
    ).sort((a,b)=>(b.vencimento||'').localeCompare(a.vencimento||'')).slice(0,3);

    return `<div style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.03));border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
        <div>
          <div style="font-weight:700;font-size:.95rem;color:var(--white)">${c.nome}</div>
          <div style="font-size:.7rem;color:var(--gray);margin-top:2px">Vence ${dataVenc}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="editarCartao('${c.id}')" style="background:rgba(255,255,255,0.1);border:none;color:var(--gray);cursor:pointer;font-size:.75rem;padding:4px 8px;border-radius:6px">✎</button>
          <button onclick="excluirCartao('${c.id}')" style="background:none;border:none;color:var(--gray);cursor:pointer;font-size:1.2rem;padding:0">×</button>
        </div>
      </div>
      <div style="font-size:1.4rem;font-weight:800;color:#f59e0b;margin-bottom:4px">${fmt(totalFatura)}${limite>0?` <span style="font-size:.75rem;color:var(--gray);font-weight:400">de ${fmt(limite)}</span>`:''}</div>
      <div style="font-size:.7rem;color:var(--gray);margin-bottom:6px">${gastosCartao.length} compra(s) na fatura</div>
      ${limite>0?`<div style="background:rgba(0,0,0,0.2);height:6px;border-radius:99px;overflow:hidden;margin-bottom:8px">
        <div style="background:${corBarra};height:100%;width:${percentual}%;transition:width .3s ease,background .3s ease;border-radius:99px"></div>
      </div>`:''}
      ${faturasHistorico.length>0?`<details style="margin-top:10px"><summary style="font-size:.7rem;color:var(--gray);cursor:pointer">Histórico</summary><div style="margin-top:6px;font-size:.7rem;color:var(--gray)">${faturasHistorico.map(f=>`${fmtData(f.vencimento)} — ${fmt(f.valor)}`).join('<br>')}</div></details>`:''}
    </div>`;
  }).join('');
}

function renderizarFaturasCartao(){
  const container=document.getElementById('faturas-cartao-container');
  if(!container) return;

  // Filtrar gastos por cartão
  const gastosCartao=movimentacoes.filter(m=>m.tipo==='gasto'&&m.metodoPagamento==='cartao'&&m.fatura);

  if(gastosCartao.length===0){
    container.style.display='none';
    return;
  }

  container.style.display='block';

  // Agrupar por fatura (YYYY-MM)
  const porFatura={};
  gastosCartao.forEach(g=>{
    if(!porFatura[g.fatura])porFatura[g.fatura]=[];
    porFatura[g.fatura].push(g);
  });

  // Ordenar faturas (mais recente primeiro)
  const faturas=Object.keys(porFatura).sort().reverse();

  const html=faturas.slice(0,3).map(fatura=>{
    const gastos=porFatura[fatura];
    const total=gastos.reduce((s,g)=>s+(g.valor||0),0);
    const [ano,mes]=fatura.split('-');
    const mesesNome=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const nomeFatura=`${mesesNome[parseInt(mes)-1]}/${ano}`;

    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:.75rem;color:var(--gray);margin-bottom:2px">Fatura ${nomeFatura}</div>
          <div style="font-size:1.3rem;font-weight:800;color:#f59e0b">${fmt(total)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:.7rem;color:var(--gray)">${gastos.length} compra(s)</div>
        </div>
      </div>
      <div style="max-height:120px;overflow-y:auto">
        ${gastos.slice(0,5).map(g=>`<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:.8rem;border-top:1px solid rgba(255,255,255,0.05)">
          <span style="color:var(--gray-2)">${g.descricao||'Compra'}</span>
          <span style="color:var(--white);font-weight:600">${fmt(g.valor)}</span>
        </div>`).join('')}
        ${gastos.length>5?`<div style="font-size:.7rem;color:var(--gray);margin-top:6px;text-align:center">+${gastos.length-5} compras</div>`:''}
      </div>
    </div>`;
  }).join('');

  container.innerHTML=`<div class="card-title" style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;color:#f59e0b"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
    Faturas de Cartão
  </div>${html}`;
}

function renderizarContas(){
  const el=document.getElementById('lista-contas'); if(!el) return;
  const hoje=new Date();const em3=new Date(hoje);em3.setDate(em3.getDate()+3);

  // Mês/ano atual
  const anoAtual=hoje.getFullYear();
  const mesAtual=hoje.getMonth()+1;
  const anoMesAtual=`${anoAtual}-${String(mesAtual).padStart(2,'0')}`;

  let lista=[...contas];

  // Ocultar contas pagas de meses anteriores
  lista=lista.filter(c=>{
    if(!c.paga) return true; // Sempre mostrar contas não pagas
    if(!c.vencimento) return true; // Se não tem vencimento, mostrar
    // Se paga, verificar se é do mês atual
    return c.vencimento.startsWith(anoMesAtual);
  });

  // Aplicar filtros de visualização
  if(filtroContasAtual==='pendentes') lista=lista.filter(c=>!c.paga);
  else if(filtroContasAtual==='vencidas') lista=lista.filter(c=>!c.paga&&c.vencimento<dataHoje());
  else if(filtroContasAtual==='pagas') lista=lista.filter(c=>c.paga);
  const kT=document.getElementById('contas-kpi-total');const kQ=document.getElementById('contas-kpi-qtd');
  const kV=document.getElementById('contas-kpi-vencidas');const kP=document.getElementById('contas-kpi-proximas');const kPg=document.getElementById('contas-kpi-pagas');
  const cntEl=document.getElementById('contas-lista-count');

  // Filtrar apenas contas visíveis (mesma lógica da lista)
  const contasVisiveis=contas.filter(c=>{
    if(!c.paga) return true; // Sempre considerar não pagas
    if(!c.vencimento) return true;
    return c.vencimento.startsWith(anoMesAtual); // Pagas apenas do mês atual
  });

  const totalPend=contasVisiveis.filter(c=>!c.paga).reduce((s,c)=>s+(c.valor||0),0);
  const qtdVenc=contasVisiveis.filter(c=>!c.paga&&c.vencimento<dataHoje()).length;
  const qtdProx=contasVisiveis.filter(c=>!c.paga&&c.vencimento>=dataHoje()&&c.vencimento<=em3.toISOString().split('T')[0]).length;
  const qtdPagas=contasVisiveis.filter(c=>c.paga).length;
  if(kT)kT.textContent=fmt(totalPend);if(kQ)kQ.textContent=`${contasVisiveis.filter(c=>!c.paga).length} pendente(s)`;
  if(kV)kV.textContent=qtdVenc;if(kP)kP.textContent=qtdProx;if(kPg)kPg.textContent=qtdPagas;
  if(cntEl)cntEl.textContent=`${lista.length} contas`;
  renderizarCalendarioContas();
  if(lista.length===0){el.innerHTML=`<div class="vazio">Nenhuma conta ${filtroContasAtual==='todas'?'cadastrada':'nesta categoria'}.</div>`;return;}
  lista.sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||''));
  el.innerHTML=lista.map(c=>{
    const isVenc=!c.paga&&c.vencimento<dataHoje();
    const isProx=!c.paga&&!isVenc&&c.vencimento<=em3.toISOString().split('T')[0];
    const badge=c.paga?'badge-green':isVenc?'badge-red':isProx?'badge-yellow':'badge-gray';
    const blbl=c.paga?'Paga':isVenc?'Vencida':isProx?'Próxima':'Pendente';
    return `<div style="background:var(--card-bg);border:1px solid ${isVenc?'rgba(239,68,68,0.3)':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div><div style="font-weight:700">${c.descricao}</div><div style="font-size:.75rem;color:var(--gray)">${c.categoria||''} · Vence ${fmtData(c.vencimento)}${c.recorrente?' · Recorrente':''}</div></div>
        <div style="text-align:right"><div style="font-weight:800;color:${c.paga?'#22c55e':'#f59e0b'}">${fmt(c.valor)}</div><span class="badge ${badge}" style="font-size:.7rem">${blbl}</span></div>
      </div>
      ${!c.paga?`<div style="display:flex;gap:8px"><button class="btn-sm-green" onclick="pagarConta('${c.id}')">✓ Marcar paga</button><button class="btn-sm-gray" onclick="editarConta('${c.id}')">Editar</button><button class="btn-sm-red" onclick="excluirConta('${c.id}')">Excluir</button></div>`:`<button class="btn-sm-red" onclick="excluirConta('${c.id}')">Remover</button>`}
    </div>`;
  }).join('');
}
function renderizarCalendarioContas(){
  const grid=document.getElementById('contas-grid-dias');const label=document.getElementById('contas-mes-label');
  if(!grid||!label) return;
  const mN=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  label.textContent=`${mN[mesContas.getMonth()]} ${mesContas.getFullYear()}`;
  const firstDay=new Date(mesContas.getFullYear(),mesContas.getMonth(),1).getDay();
  const daysInMonth=new Date(mesContas.getFullYear(),mesContas.getMonth()+1,0).getDate();
  const hoje=new Date();
  const cDias={};
  contas.forEach(c=>{if(c.vencimento){const d=new Date(c.vencimento+'T00:00:00');if(d.getMonth()===mesContas.getMonth()&&d.getFullYear()===mesContas.getFullYear()){const day=d.getDate();if(!cDias[day])cDias[day]=[];cDias[day].push(c);}}});
  const headers=Array.from(grid.children).slice(0,7);grid.innerHTML='';headers.forEach(h=>grid.appendChild(h));
  for(let i=0;i<firstDay;i++){const el=document.createElement('div');grid.appendChild(el);}
  for(let d=1;d<=daysInMonth;d++){
    const el=document.createElement('div');
    const isH=d===hoje.getDate()&&mesContas.getMonth()===hoje.getMonth()&&mesContas.getFullYear()===hoje.getFullYear();
    const tC=cDias[d];
    let bg='transparent',color='var(--text)',border='none';
    if(isH){bg='var(--primary)';color='#000';}
    else if(tC){const aV=tC.some(c=>!c.paga&&c.vencimento<dataHoje());bg=aV?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.15)';border=`1px solid ${aV?'rgba(239,68,68,0.4)':'rgba(34,197,94,0.3)'}`;}
    el.style.cssText=`font-size:.72rem;padding:4px 2px;border-radius:6px;background:${bg};color:${color};border:${border};font-weight:${isH||tC?'700':'400'};text-align:center`;
    el.textContent=d;grid.appendChild(el);
  }
}
window.criarContasDeRotina=async function(){
  if(!uidAtual) return;
  const rotina=perfilUsuario?.perfilVida?.rotina||[];
  const nomes={
    netflix:'Netflix',spotify:'Spotify',youtube:'YouTube Premium',
    hbo:'Max (HBO)',prime:'Prime Video',disney:'Disney+',
    chatgpt:'ChatGPT Plus',notion:'Notion',canva:'Canva',capcut:'CapCut',
    internet:'Internet',celular:'Celular',academia:'Academia',
    luta:'Luta / Artes Marciais',futebol:'Futebol',
  };
  const valorPadrao={
    netflix:59.90,spotify:21.90,youtube:27.90,hbo:34.90,prime:19.90,disney:43.90,
    chatgpt:100,notion:0,canva:0,capcut:0,internet:0,celular:0,academia:0,luta:0,futebol:0,
  };
  const hoje=new Date();
  const venc=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-10`;
  const criados=[];
  const rotinasFixas=['netflix','spotify','youtube','hbo','prime','disney','chatgpt','notion','canva','capcut','internet','celular','academia','luta','futebol'];
  for(const r of rotina){
    const nome=nomes[r]||r;
    // Verifica se já existe uma conta com esse nome para não duplicar
    const jaExiste=contas.some(c=>c.descricao.toLowerCase()===nome.toLowerCase());
    if(!jaExiste){
      const val=valorPadrao[r]||0;
      await adicionarConta(uidAtual,{
        descricao:nome,
        valor:val,
        vencimento:venc,
        categoria:rotinasFixas.includes(r)?'Assinatura':'Outros',
        recorrente:true,
        paga:false
      });
      criados.push(nome);
    }
  }
  // Recarregar contas
  contas=await getContas(uidAtual);
  renderizarContas();
  // Esconder banner só após criar
  const b=document.getElementById('banner-rotina-contas');
  if(b) b.style.display='none';
  if(criados.length>0){
    const msg=criados.length===1?`Conta "${criados[0]}" criada!`:`${criados.length} contas criadas com sucesso!`;
    showToast(msg, 'success');
  }
};

// ── Relatório ─────────────────────────────────────────────────────
window.setPeriodoModo=function(modo){
  periodoModo=modo;
  const tM=document.getElementById('tab-mes');const tC=document.getElementById('tab-custom');
  const nM=document.getElementById('periodo-mes-nav');const nC=document.getElementById('periodo-custom-nav');
  if(tM)tM.classList.toggle('active',modo==='mes');if(tC)tC.classList.toggle('active',modo==='custom');
  if(nM)nM.style.display=modo==='mes'?'flex':'none';if(nC)nC.style.display=modo==='custom'?'block':'none';
  renderizarRelatorio();
};
window.mudarMesRelatorio=function(delta){
  mesRelatorio=new Date(mesRelatorio.getFullYear(),mesRelatorio.getMonth()+delta,1);
  console.log('[NAVEGAÇÃO] Mês alterado para:', mesRelatorio.getFullYear(), '/', (mesRelatorio.getMonth() + 1));
  renderizarRelatorio();
};
window.aplicarPeriodoCustom=function(){
  periodoCustomInicio=document.getElementById('periodo-inicio').value;
  periodoCustomFim=document.getElementById('periodo-fim').value;
  if(periodoCustomInicio&&periodoCustomFim){const lEl=document.getElementById('periodo-custom-label');if(lEl)lEl.textContent=`${fmtData(periodoCustomInicio)} → ${fmtData(periodoCustomFim)}`;renderizarRelatorio();}
};
window.atalhoUltimos=function(dias){
  const hoje=new Date();const ini=new Date(hoje);ini.setDate(ini.getDate()-dias);
  periodoCustomInicio=ini.toISOString().split('T')[0];periodoCustomFim=hoje.toISOString().split('T')[0];
  const pi=document.getElementById('periodo-inicio');const pf=document.getElementById('periodo-fim');
  if(pi)pi.value=periodoCustomInicio;if(pf)pf.value=periodoCustomFim;renderizarRelatorio();
};
function getMovsRelatorio(){
  if(periodoModo==='custom'&&periodoCustomInicio&&periodoCustomFim) return movimentacoes.filter(m=>m.data>=periodoCustomInicio&&m.data<=periodoCustomFim);

  const anoRelatorio = mesRelatorio.getFullYear();
  const mesRelatorioNum = mesRelatorio.getMonth();
  const mesRelatorioStr = String(mesRelatorioNum + 1).padStart(2, '0'); // Converte mês para string "01", "02", etc
  const anoRelatorioStr = String(anoRelatorio);
  const prefixoBusca = `${anoRelatorioStr}-${mesRelatorioStr}`; // Ex: "2026-04"

  console.log('[RELATÓRIO] Buscando movimentações para:', prefixoBusca);
  console.log('[RELATÓRIO] Total de movimentações disponíveis:', movimentacoes.length);

  // Agrupar por mês para diagnóstico
  const porMes = {};
  movimentacoes.forEach(m => {
    if (m.data) {
      const mesAno = m.data.substring(0, 7); // "2026-04"
      porMes[mesAno] = (porMes[mesAno] || 0) + 1;
    }
  });
  console.log('[RELATÓRIO] Distribuição por mês:', porMes);
  console.log('[RELATÓRIO] Primeiras 10 datas:', movimentacoes.slice(0, 10).map(m => m.data));
  console.log('[RELATÓRIO] Últimas 10 datas:', movimentacoes.slice(-10).map(m => m.data));

  // Filtro usando prefixo de string (mais confiável)
  const resultado = movimentacoes.filter(m => {
    if(!m.data) return false;
    return m.data.startsWith(prefixoBusca);
  });

  console.log('[RELATÓRIO] ==============================');
  console.log('[RELATÓRIO] Buscando mês:', prefixoBusca);
  console.log('[RELATÓRIO] Movimentações encontradas:', resultado.length);
  if(resultado.length > 0) {
    console.log('[RELATÓRIO] Primeiras 5 encontradas:', resultado.slice(0, 5).map(m => ({ data: m.data, descricao: m.descricao, valor: m.valor })));
  } else {
    console.log('[RELATÓRIO] ⚠️ NENHUMA movimentação encontrada para', prefixoBusca);
    console.log('[RELATÓRIO] ⚠️ Verifique se há dados deste mês no Firebase!');
  }
  console.log('[RELATÓRIO] ==============================');

  return resultado;
}
async function renderizarRelatorio(){
  console.log('[RENDERIZAR] renderizarRelatorio() chamada');
  const mN=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const lEl=document.getElementById('relatorio-mes-label');if(lEl)lEl.textContent=`${mN[mesRelatorio.getMonth()]} ${mesRelatorio.getFullYear()}`;

  // Verificar se é mês atual ou anterior
  const agora = new Date();
  const mesAno = `${mesRelatorio.getFullYear()}-${String(mesRelatorio.getMonth()+1).padStart(2,'0')}`;
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;

  let ent = 0;
  let sai = 0;
  let sal = 0;
  let totalMovs = 0;
  let movs = [];

  // Se for mês atual, usar movimentacoes em tempo real
  if (mesAno === mesAtual) {
    movs = getMovsRelatorio();
    console.log('[RENDERIZAR] Mês atual - Total de movimentações:', movs.length);
    ent = movs.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
    sai = movs.filter(m=>m.tipo==='gasto').reduce((s,m)=>s+(m.valor||0),0);
    sal = ent - sai;
    totalMovs = movs.length;
  } else {
    // Se for mês anterior, buscar movimentações do Firebase
    console.log('[RENDERIZAR] Mês anterior - Buscando do Firebase:', mesAno);
    if (uidAtual) {
      try {
        const ano = mesRelatorio.getFullYear();
        const mes = mesRelatorio.getMonth() + 1;
        const mesStr = String(mes).padStart(2, '0');
        const dataInicio = `${ano}-${mesStr}-01`;
        const dataFim = `${ano}-${mesStr}-31`;

        const q = query(
          collection(db, 'usuarios', uidAtual, 'movimentacoes'),
          where('data', '>=', dataInicio),
          where('data', '<=', dataFim)
        );

        const snap = await getDocs(q);
        movs = snap.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .sort((a, b) => {
            if (a.data !== b.data) return (b.data || '').localeCompare(a.data || '');
            const ta = a.criadoEm?.toMillis?.() || 0;
            const tb = b.criadoEm?.toMillis?.() || 0;
            return tb - ta;
          });

        console.log('[RENDERIZAR] Movimentações do Firebase:', movs.length);

        ent = movs.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
        sai = movs.filter(m=>m.tipo==='gasto').reduce((s,m)=>s+(m.valor||0),0);
        sal = ent - sai;
        totalMovs = movs.length;
      } catch(e) {
        console.error('[RENDERIZAR] Erro ao buscar dados:', e);
        movs = [];
      }
    }
  }

  const rE=document.getElementById('rel-entradas');const rS=document.getElementById('rel-saidas');const rSa=document.getElementById('rel-saldo');const rT=document.getElementById('rel-total');
  if(rE)rE.textContent=fmt(ent);if(rS)rS.textContent=fmt(sai);
  if(rSa){rSa.textContent=fmtSaldo(sal);rSa.style.color=sal<0?'#ef4444':'#22c55e';}
  if(rT)rT.textContent=totalMovs;
  const topEl=document.getElementById('relatorio-top-gastos');
  if(topEl){
    const gastos=movs.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).sort((a,b)=>b.valor-a.valor).slice(0,5);
    if(gastos.length===0)topEl.innerHTML='<div class="vazio">Nenhum gasto neste período.</div>';
    else topEl.innerHTML=gastos.map(m=>`<div class="mov-item" style="padding:16px 14px;"><div class="mov-info"><div class="mov-desc">${m.descricao}</div><div class="mov-cat">${m.categoria||''} · ${fmtData(m.data)}</div></div><div class="mov-valor red">-${fmt(m.valor)}</div></div>`).join('');
  }
  const rEl=document.getElementById('lista-recorrentes');
  if(rEl){const recs=movimentacoes.filter(m=>m.recorrente);if(recs.length===0)rEl.innerHTML='<div class="vazio">Nenhum lançamento recorrente cadastrado.</div>';else rEl.innerHTML=recs.map(m=>`<div class="mov-item" style="padding:16px 14px;"><div class="mov-info"><div class="mov-desc">${m.descricao}</div><div class="mov-cat">${m.tipo==='ganho'?'Entrada':'Saída'} recorrente</div></div><div class="mov-valor ${m.tipo==='ganho'?'green':'red'}">${m.tipo==='ganho'?'+':'-'}${fmt(m.valor)}</div></div>`).join('');}
  // ── Necessidade vs Desejo ────────────────────────────────────────
  const ndEl = document.getElementById('rel-nd-content');
  if(ndEl){
    const gastos = movs.filter(m => m.tipo==='gasto' && naoEQuitacao(m));
    const nec = gastos.filter(m => m.classificacao==='necessidade');
    const des = gastos.filter(m => m.classificacao==='desejo');
    const semClass = gastos.filter(m => !m.classificacao || m.classificacao==='quitacao_divida');
    const totNec = nec.reduce((s,m)=>s+(m.valor||0),0);
    const totDes = des.reduce((s,m)=>s+(m.valor||0),0);
    const totSem = semClass.reduce((s,m)=>s+(m.valor||0),0);
    const totGasto = totNec + totDes + totSem;

    if(totGasto===0){
      ndEl.innerHTML='<div class="vazio">Nenhum gasto neste período.</div>';
    } else {
      const pNec = totGasto>0?Math.round(totNec/totGasto*100):0;
      const pDes = totGasto>0?Math.round(totDes/totGasto*100):0;
      const pSem = 100-pNec-pDes;
      ndEl.innerHTML=`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:16px;text-align:center">
            <img src="icone-cerebro.png" style="width:32px;height:32px;object-fit:contain;margin-bottom:8px">
            <div style="font-size:.75rem;color:var(--gray);text-transform:uppercase;letter-spacing:.05em">Necessidade</div>
            <div style="font-size:1.3rem;font-weight:800;color:#22c55e;margin:4px 0">${fmt(totNec)}</div>
            <div style="font-size:.8rem;color:var(--gray)">${pNec}% dos gastos · ${nec.length} item(ns)</div>
          </div>
          <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:14px;padding:16px;text-align:center">
            <img src="icone-lazer.png" style="width:32px;height:32px;object-fit:contain;margin-bottom:8px">
            <div style="font-size:.75rem;color:var(--gray);text-transform:uppercase;letter-spacing:.05em">Desejo</div>
            <div style="font-size:1.3rem;font-weight:800;color:#f59e0b;margin:4px 0">${fmt(totDes)}</div>
            <div style="font-size:.8rem;color:var(--gray)">${pDes}% dos gastos · ${des.length} item(ns)</div>
          </div>
        </div>
        <!-- Barra de distribuição -->
        <div style="margin-bottom:12px">
          <div style="font-size:.8rem;color:var(--gray);margin-bottom:6px">Distribuição visual</div>
          <div style="display:flex;border-radius:8px;overflow:hidden;height:20px;gap:2px">
            ${pNec>0?`<div style="width:${pNec}%;background:#22c55e;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:#000">${pNec}%</div>`:''}
            ${pDes>0?`<div style="width:${pDes}%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:#000">${pDes}%</div>`:''}
            ${pSem>0?`<div style="flex:1;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:.65rem;color:var(--gray)">${pSem}% sem classif.</div>`:''}
          </div>
        </div>
        ${totSem>0?`<div style="font-size:.78rem;color:var(--gray);padding:10px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid var(--border)">
          <strong style="color:var(--white)">${fmt(totSem)}</strong> (${semClass.length} gasto(s)) ainda sem classificação. Ao registrar gastos, responda se é necessidade ou desejo para ver o relatório completo.
        </div>`:''}
        <!-- Insight automático -->
        ${totDes>0&&totNec>0?`<div style="margin-top:12px;padding:12px;background:${pDes>50?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.06)'};border:1px solid ${pDes>50?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'};border-radius:12px;font-size:.82rem;color:var(--white)">
          ${pDes>50
            ? `<strong>Atenção:</strong> ${pDes}% dos seus gastos foram por desejo. A regra 50-30-20 sugere no máximo 30%.`
            : `<strong>Ótimo controle!</strong> Apenas ${pDes}% dos seus gastos foram por desejo — dentro da meta de 30%.`
          }
        </div>`:``}
      `;
    }
  }

  // ── Todas as movimentações ──────────────────────────────────────
  renderizarTodasMovsRelatorio(movs, window._filtroRelatorio||'todos');
  renderizarChartRelatorio();
}

let _filtroRelatorioTipo = 'todos';
window.setFiltroRelatorio = function(tipo, btn) {
  _filtroRelatorioTipo = tipo;
  // Estilo dos botões
  ['todos','ganho','gasto'].forEach(t => {
    const id = t==='todos'?'rel-filtro-todos':t==='ganho'?'rel-filtro-entradas':'rel-filtro-saidas';
    const el = document.getElementById(id);
    if(!el) return;
    if(t===tipo){ el.style.borderColor='var(--primary)';el.style.background='var(--primary-dim)';el.style.color='var(--primary)'; }
    else { el.style.borderColor='var(--border)';el.style.background='transparent';el.style.color='var(--gray)'; }
  });
  renderizarTodasMovsRelatorio(getMovsRelatorio(), tipo);
};

function renderizarTodasMovsRelatorio(movs, tipo) {
  const el = document.getElementById('relatorio-todas-movs'); if(!el) return;
  const filtradas = tipo==='todos' ? movs : movs.filter(m=>m.tipo===tipo);
  if(filtradas.length===0){
    el.innerHTML='<div class="vazio">Nenhuma movimentação no período.</div>';
    return;
  }
  // Ordenar por data decrescente
  const sorted = [...filtradas].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  el.innerHTML = sorted.map(m => {
    const isGanho = m.tipo==='ganho';
    const png = getIconeCat(m.categoria||'Outros');
    const icone = png
      ? `<img src="${png}" style="width:28px;height:28px;object-fit:contain">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="${isGanho?'#22c55e':'#ef4444'}" stroke-width="2" style="width:16px;height:16px"><polyline points="${isGanho?'23 6 13.5 15.5 8.5 10.5 1 18':'23 18 13.5 8.5 8.5 13.5 1 6'}"/></svg>`;
    return `<div class="mov-item" style="display:flex;align-items:center;gap:12px;padding:16px 14px;background:var(--surface-2);border-radius:12px;border:1px solid transparent;">
      <div class="mov-icon ${isGanho?'green':'red'}" style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${isGanho?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)'}">
        ${icone}
      </div>
      <div class="mov-info" style="flex:1;min-width:0">
        <div class="mov-desc" style="font-weight:600;font-size:.88rem">${m.descricao||'—'}</div>
        <div class="mov-cat" style="font-size:.75rem;color:var(--gray);margin-top:2px">${m.categoria||''} · ${fmtData(m.data)}</div>
      </div>
      <div class="mov-valor ${isGanho?'green':'red'}" style="font-weight:700;font-size:.92rem;white-space:nowrap">
        ${isGanho?'+':'-'}${fmt(m.valor)}
      </div>
    </div>`;
  }).join('');
}
async function renderizarChartRelatorio(){
  const canvas=document.getElementById('chart-relatorio'); if(!canvas) return;
  if(!canvas.offsetWidth){setTimeout(renderizarChartRelatorio,100);return;}
  const agora=new Date();const labels=[];const dEnt=[];const dSai=[];
  const mShort=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Buscar histórico de meses anteriores
  let historico = [];
  if (uidAtual) {
    try {
      historico = await getHistorico(uidAtual);
    } catch(e) {
      console.error('[GRÁFICO] Erro ao buscar histórico:', e);
    }
  }

  for(let i=5;i>=0;i--){
    const d=new Date(agora.getFullYear(),agora.getMonth()-i,1);
    labels.push(mShort[d.getMonth()]);

    // Formatar mês para buscar no histórico: "2026-04"
    const mesAno = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;

    let entradas = 0;
    let saidas = 0;

    // Se for mês atual, usar movimentacoes em tempo real
    if (mesAno === mesAtual) {
      const mm=movimentacoes.filter(m=>{if(!m.data)return false;const md=new Date(m.data+'T00:00:00');return md.getMonth()===d.getMonth()&&md.getFullYear()===d.getFullYear();});
      entradas = mm.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
      saidas = mm.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
    } else {
      // Se for mês anterior, buscar do histórico
      const hist = historico.find(h => h.mes === mesAno);
      if (hist) {
        entradas = hist.entradas || 0;
        saidas = hist.saidas || 0;
      }
    }

    dEnt.push(entradas);
    dSai.push(saidas);
  }
  const emp=document.getElementById('relatorio-chart-empty');
  if(dEnt.every(v=>v===0)&&dSai.every(v=>v===0)){canvas.style.display='none';if(emp)emp.style.display='flex';return;}
  canvas.style.display='block';if(emp)emp.style.display='none';
  const w=canvas.parentElement?.offsetWidth||canvas.offsetWidth||600;
  canvas.width=w; canvas.height=200;
  if(chartRelatorio){chartRelatorio.destroy();chartRelatorio=null;}
  chartRelatorio=new Chart(canvas.getContext('2d'),{type:'bar',data:{labels,datasets:[{label:'Entradas',data:dEnt,backgroundColor:'rgba(34,197,94,0.7)',borderRadius:6},{label:'Saídas',data:dSai,backgroundColor:'rgba(239,68,68,0.7)',borderRadius:6}]},options:{responsive:false,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8',font:{size:12}}}},scales:{x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b'}},y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}});
}
window.carregarHistorico=async function(){
  const el=document.getElementById('historico-lista'); if(!el||!uidAtual) return;
  el.innerHTML='<div style="text-align:center;padding:16px;color:var(--gray);font-size:.85rem">Carregando...</div>';
  try{
    const hist=await getHistorico(uidAtual);
    if(hist.length===0){el.innerHTML='<div class="vazio">Nenhum histórico ainda.</div>';return;}
    const mN={' 01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril','05':'Maio','06':'Junho','07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'};
    el.innerHTML=hist.map(h=>{
      const[ano,mes]=h.mes.split('-');const lbl=`${mN[mes]||mes} ${ano}`;const cor=h.saldo>=0?'#22c55e':'#ef4444';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)"><div><div style="font-weight:700">${lbl}</div><div style="font-size:.75rem;color:var(--gray)">${h.totalMovimentacoes||0} movimentações</div></div><div style="text-align:right"><div style="font-weight:800;color:${cor}">${fmtSaldo(h.saldo)}</div><div style="font-size:.72rem;color:var(--gray)">+${fmt(h.entradas)} / -${fmt(h.saidas)}</div></div></div>`;
    }).join('');
  }catch(e){el.innerHTML='<div class="vazio">Erro ao carregar histórico.</div>';}
};
window.processarRecorrentes=function(){
  const recs=movimentacoes.filter(m=>m.recorrente);
  if(recs.length===0){showToast('Nenhum lançamento recorrente cadastrado.','info');return;}
  confirmarAcao(`Lançar ${recs.length} recorrente(s) para este mês?`, async ()=>{
    try{
      for(const m of recs) await adicionarMovimentacao(uidAtual,{valor:m.valor,descricao:m.descricao,tipo:m.tipo,data:dataHoje(),categoria:m.categoria,recorrente:false});
      movimentacoes=await getMovimentacoes(uidAtual);
      renderizarListaInicio();atualizarKPIs();atualizarChart();
      showToast('Lançamentos adicionados!','success');
    }catch(e){showToast('Erro ao processar recorrentes.','error');console.error(e);}
  });
};

// ── Score ─────────────────────────────────────────────────────────
// Retorna o valor numérico do score sem atualizar o DOM
function calcularScoreValor(){
  const ent=movimentacoes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const sai=movimentacoes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const sal=ent-sai; const renda=perfilUsuario?.renda||ent||1;
  const pctGasto=ent>0?(sai/ent)*100:100;
  const pG=pctGasto<=50?300:pctGasto<=70?200:pctGasto<=90?100:30;
  const totDiv=dividas.reduce((s,d)=>s+(d.valor||0),0); const relDiv=renda>0?totDiv/renda:0;
  const pD=(dividas.filter(d=>d.status!=='quitada')).length===0?200:relDiv<1?150:relDiv<3?80:20;
  const pM=metas.length===0?50:Math.round((metas.reduce((s,m)=>s+(m.valor>0?(m.atual||0)/m.valor:0),0)/metas.length)*200);
  const pR=sal>renda*6?200:sal>renda*3?150:sal>renda?80:sal>0?40:0;
  const hoje=new Date(); const mMes=movimentacoes.filter(m=>{if(!m.data)return false;const d=new Date(m.data+'T00:00:00');return d.getMonth()===hoje.getMonth()&&d.getFullYear()===hoje.getFullYear();});
  const pC=Math.min(100,mMes.length*10);
  return pG+pD+Math.min(200,pM)+pR+pC;
}

// Toast genérico para feedback não-bloqueante
function showToast(msg, tipo='info') {
  const ex = document.getElementById('app-toast');
  if (ex) ex.remove();
  const t = document.createElement('div');
  t.id = 'app-toast';
  const cor = tipo==='success'?'#22c55e':tipo==='error'?'#ef4444':'#3b82f6';
  t.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#0f172a;border:1px solid ${cor};border-radius:14px;padding:14px 22px;z-index:99999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:220px;max-width:90vw;animation:fadeUp .3s ease;font-size:.88rem;color:#fff;line-height:1.4;pointer-events:none`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { if(t.parentNode) t.remove(); }, 3500);
}
window.showToast = showToast;

// Toast de parabéns ao quitar dívida
function mostrarToastScore(ganho, nomeDivida){
  const existing = document.getElementById('toast-score');
  if(existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast-score';
  const cor = ganho > 0 ? '#22c55e' : '#f59e0b';
  const icone = ganho > 0 ? 'icone-trofeu.png' : 'icone-score-bom.png';
  toast.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#0f172a;border:1px solid ${cor};border-radius:16px;padding:16px 24px;z-index:99999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:260px;animation:fadeUp .3s ease`;
  toast.innerHTML = `
    <img src="${icone}" style="width:40px;height:40px;object-fit:contain;margin-bottom:6px">
    <div style="color:#fff;font-weight:700;font-size:.95rem">Dívida quitada!</div>
    <div style="color:#94a3b8;font-size:.82rem;margin:4px 0">${nomeDivida}</div>
    ${ganho > 0
      ? `<div style="color:${cor};font-weight:800;font-size:1.1rem;margin-top:6px">+${ganho} pts no Score</div>`
      : `<div style="color:${cor};font-weight:700;font-size:.9rem;margin-top:6px">Score atualizado</div>`
    }`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.transition='opacity .5s'; toast.style.opacity='0'; setTimeout(()=>toast.remove(), 500); }, 3000);
}

function calcularScore(){
  const ent=movimentacoes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const sai=movimentacoes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const sal=ent-sai;const renda=perfilUsuario?.renda||ent||1;
  const pctGasto=ent>0?(sai/ent)*100:100;
  let pG=pctGasto<=50?300:pctGasto<=70?200:pctGasto<=90?100:30;
  const totDiv=dividas.reduce((s,d)=>s+(d.valor||0),0);const relDiv=renda>0?totDiv/renda:0;
  let pD=dividas.length===0?200:relDiv<1?150:relDiv<3?80:20;
  let pM=metas.length===0?50:Math.round((metas.reduce((s,m)=>s+(m.valor>0?(m.atual||0)/m.valor:0),0)/metas.length)*200);
  let pR=sal>renda*6?200:sal>renda*3?150:sal>renda?80:sal>0?40:0;
  const hoje=new Date();const mMes=movimentacoes.filter(m=>{if(!m.data)return false;const d=new Date(m.data+'T00:00:00');return d.getMonth()===hoje.getMonth()&&d.getFullYear()===hoje.getFullYear();});
  const pC=Math.min(100,mMes.length*10);
  const score=pG+pD+Math.min(200,pM)+pR+pC;
  let cls='',cor='#22c55e',emoji='⭐';
  if(score>=800){cls='Excelente';cor='#22c55e';emoji='🏆';}
  else if(score>=600){cls='Bom';cor='#3b82f6';emoji='👍';}
  else if(score>=400){cls='Estável';cor='#f59e0b';emoji='😐';}
  else if(score>=200){cls='Atenção';cor='#f97316';emoji='⚠️';}
  else{cls='Crítico';cor='#ef4444';emoji='🚨';}
  const sn=document.getElementById('score-numero');if(sn)sn.textContent=score;
  const sb=document.getElementById('score-badge');
  if(sb){
    const iconeScore=score>=800?'icone-score-excelente.png':score>=600?'icone-score-bom.png':score>=400?'icone-score-estavel.png':score>=200?'icone-score-atencao.png':'icone-score-critico.png';
    sb.innerHTML=`<img src="${iconeScore}" alt="${cls}" style="width:32px;height:32px;object-fit:contain;vertical-align:middle;margin-right:6px;margin-bottom:2px"><span style="color:${cor};font-weight:800">${cls}</span>`;
    sb.style.color=cor;
  }
  const st=document.getElementById('score-tip');
  if(st){if(score>=800)st.textContent='Excelente! Você tem um controle financeiro muito sólido.';else if(score>=600)st.textContent='Bom trabalho! Continue registrando e economizando.';else if(score>=400)st.textContent='Você está no caminho certo. Reduza gastos para avançar.';else st.textContent='Situação crítica. Priorize quitar dívidas e cortar gastos.';}
  const arc=document.getElementById('score-gauge-arc');if(arc){const pct=score/1000;arc.style.strokeDashoffset=251.3-(251.3*pct);arc.style.stroke=cor;}
  const mini=document.getElementById('kpi-score-mini');if(mini)mini.textContent=score;
  const iconeScore2=score>=800?'icone-score-excelente.png':score>=600?'icone-score-bom.png':score>=400?'icone-score-estavel.png':score>=200?'icone-score-atencao.png':'icone-score-critico.png';
  const miniImg=document.getElementById('kpi-score-mini-img');
  const miniIcon=document.getElementById('kpi-score-mini-icon');
  if(miniImg){
    miniImg.src=iconeScore2;
    if(miniIcon){
      miniIcon.className='kpi-icon';
      if(score>=600) miniIcon.classList.add('green');
      else if(score>=400) miniIcon.classList.add('yellow');
      else miniIcon.classList.add('red');
    }
  }
  const mL=document.getElementById('kpi-score-mini-label');if(mL)mL.textContent=`${cls} →`;
  function aCrit(id,pts,max,lbl){
    const pE=document.getElementById(`${id}-pts`);const bE=document.getElementById(`${id}-bar`);const lE=document.getElementById(`${id}-label`);
    if(pE)pE.textContent=`${pts} pts`;if(bE)bE.style.width=`${(pts/max)*100}%`;if(lE)lE.textContent=lbl;
  }
  aCrit('sc-gastos',pG,300,`${pctGasto.toFixed(0)}% da renda comprometida`);
  aCrit('sc-dividas',pD,200,dividas.length===0?'Sem dívidas ativas':`${fmt(totDiv)} em dívidas`);
  aCrit('sc-metas',Math.min(200,pM),200,metas.length===0?'Nenhuma meta criada':`${metas.length} meta(s) ativa(s)`);
  aCrit('sc-reserva',pR,200,`Saldo atual: ${fmtSaldo(sal)}`);
  aCrit('sc-consistencia',pC,100,`${mMes.length} lançamentos este mês`);
  const dEl=document.getElementById('score-dicas-lista');
  if(dEl){
    const d=[];
    // Dicas de alerta — problemas detectados
    if(pctGasto>80)d.push({ico:'icone-grafico-02.png',txt:'Seus gastos estão acima de 80% da renda. Identifique os maiores e corte.'});
    if(dividas.filter(d=>d.status!=='quitada').length>0)d.push({ico:'icone-cartao-02.png',txt:'Você tem dívidas ativas. Priorize as de maior juros.'});
    if(metas.length===0)d.push({ico:'icone-meta.png',txt:'Crie metas financeiras para ter objetivos claros.'});
    if(sal<=0)d.push({ico:'icone-cofre.png',txt:'Construa uma reserva de emergência de pelo menos 3 meses de gastos.'});
    if(mMes.length<5)d.push({ico:'icone-dre.png',txt:'Registre mais lançamentos para ter um diagnóstico mais preciso.'});
    // Dicas educativas — sempre aparecem
    if(pctGasto<=80&&pctGasto>0)d.push({ico:'icone-grafico-01.png',txt:`Seus gastos estão em ${pctGasto.toFixed(0)}% da renda. Meta ideal: abaixo de 70%.`});
    if(sal>0)d.push({ico:'icone-cofre.png',txt:`Saldo positivo de ${fmt(sal)}. Considere investir o excedente em Tesouro Selic ou CDB.`});
    if(metas.length>0){const pctMeta=metas.reduce((s,m)=>s+(m.valor>0?(m.atual||0)/m.valor:0),0)/metas.length*100;d.push({ico:'icone-meta.png',txt:`Suas metas estão ${pctMeta.toFixed(0)}% concluídas em média. Continue contribuindo regularmente.`});}
    if(dividas.filter(d=>d.status!=='quitada').length===0)d.push({ico:'icone-score-bom.png',txt:'Sem dívidas ativas! Mantenha esse controle e evite parcelamentos desnecessários.'});
    d.push({ico:'icone-investimento.png',txt:'Regra 50-30-20: 50% necessidades, 30% desejos, 20% poupança e investimentos.'});
    dEl.innerHTML=d.map(x=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:.88rem;line-height:1.5"><img src="${x.ico}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0"><span>${x.txt}</span></div>`).join('');
  }
}

// ── Insights ──────────────────────────────────────────────────────
function gerarInsights(){
  const panel=document.getElementById('insights-panel');const list=document.getElementById('insights-list');const cEl=document.getElementById('insights-count');
  if(!panel||!list) return;
  const insights=[];
  const ent=movimentacoes.filter(m=>m.tipo==='ganho').reduce((s,m)=>s+(m.valor||0),0);
  const sai=movimentacoes.filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)).reduce((s,m)=>s+(m.valor||0),0);
  const vida=perfilUsuario?.perfilVida||{};
  const rotina=vida.rotina||[];

  // ── Alertas financeiros ──────────────────────────────────
  if(sai>ent*0.9&&ent>0)
    insights.push({png:'icone-urgente.png',bg:'rgba(239,68,68,0.15)',titulo:'Gastos altos',desc:`Seus gastos representam ${((sai/ent)*100).toFixed(0)}% das entradas. Considere reduzir.`,acao:()=>irPara('gastos'),btnLabel:'Ver gastos →'});
  if(dividas.length>0)
    insights.push({png:'icone-cartao-02.png',bg:'rgba(239,68,68,0.12)',titulo:'Dívidas ativas',desc:`Você tem ${dividas.length} dívida(s). Veja a aba Dívidas.`,acao:()=>irPara('dividas'),btnLabel:'Ver dívidas →'});
  const cVenc=contas.filter(c=>!c.paga&&c.vencimento<dataHoje());
  if(cVenc.length>0)
    insights.push({png:'icone-urgente.png',bg:'rgba(239,68,68,0.15)',titulo:`${cVenc.length} contas vencidas!`,desc:`Total em atraso: ${fmt(cVenc.reduce((s,c)=>s+(c.valor||0),0))}. Juros e multas aumentam a cada dia.`,acao:()=>irPara('contas'),btnLabel:'Resolver agora →'});
  const mPerto=metas.filter(m=>m.valor>0&&(m.atual/m.valor)>=0.8);
  if(mPerto.length>0)
    insights.push({png:'icone-trofeu.png',bg:'rgba(34,197,94,0.12)',titulo:'Meta quase atingida!',desc:`${mPerto[0].nome} está em ${((mPerto[0].atual/mPerto[0].valor)*100).toFixed(0)}%. Você está perto!`,acao:()=>irPara('metas'),btnLabel:'Ver meta →'});

  // ── Insights baseados no perfil ──────────────────────────
  const ROTINA_INSIGHTS={
    academia:{png:'icone-academia.png',bg:'rgba(34,197,94,0.1)',titulo:'Academia no perfil',desc:'Você cadastrou academia na rotina. Lembre de registrar esse gasto mensalmente.'},
    luta:{png:'icone-luta.png',bg:'rgba(139,92,246,0.1)',titulo:'Luta / Artes marciais',desc:'Registre sua mensalidade de artes marciais para manter o controle.'},
    futebol:{png:'icone-futebol.png',bg:'rgba(34,197,94,0.1)',titulo:'Futebol no perfil',desc:'Não esqueça de registrar os gastos com futebol e esportes.'},
    netflix:{png:'icone-streaming.png',bg:'rgba(229,9,20,0.1)',titulo:'Netflix',desc:'Você assina Netflix. Registre como gasto recorrente para não perder o controle.'},
    spotify:{png:'icone-streaming.png',bg:'rgba(30,215,96,0.1)',titulo:'Spotify',desc:'Registre sua assinatura do Spotify mensalmente.'},
    youtube:{png:'icone-streaming.png',bg:'rgba(255,0,0,0.1)',titulo:'YouTube Premium',desc:'Sua assinatura do YouTube Premium deve ser registrada como gasto fixo.'},
    hbo:{png:'icone-streaming.png',bg:'rgba(139,92,246,0.1)',titulo:'Max (HBO)',desc:'Registre sua assinatura do Max como gasto recorrente.'},
    prime:{png:'icone-streaming.png',bg:'rgba(0,168,225,0.1)',titulo:'Prime Video',desc:'Sua assinatura Amazon Prime deve ser registrada mensalmente.'},
    disney:{png:'icone-streaming.png',bg:'rgba(17,60,207,0.1)',titulo:'Disney+',desc:'Registre sua assinatura do Disney+ como gasto fixo.'},
    chatgpt:{png:'icone-ferramenta-cognitiva.png',bg:'rgba(16,163,127,0.1)',titulo:'ChatGPT Plus',desc:'Sua assinatura do ChatGPT Plus é um gasto digital — não esqueça de registrar.'},
    canva:{png:'icone-ferramenta-cognitiva.png',bg:'rgba(0,196,204,0.1)',titulo:'Canva',desc:'Se você paga pelo Canva Pro, registre como gasto recorrente.'},
    capcut:{png:'icone-ferramenta-cognitiva.png',bg:'rgba(0,0,0,0.15)',titulo:'CapCut',desc:'Registre sua assinatura do CapCut se for paga.'},
    internet:{png:'icone-internet.png',bg:'rgba(59,130,246,0.1)',titulo:'Internet / Celular',desc:'Registre sua conta de internet ou celular para melhorar a precisão do score.',btnLabel:'Registrar gasto →'},
    celular:{png:'icone-celular.png',bg:'rgba(100,116,139,0.1)',titulo:'Celular',desc:'Registre o plano do seu celular como gasto recorrente.',btnLabel:'Registrar gasto →'},
  };

  // Mostrar no máximo 3 cards de perfil para não poluir
  let perfilCount=0;
  for(const r of rotina){
    if(perfilCount>=3) break;
    const info=ROTINA_INSIGHTS[r];
    if(info && !insights.some(i=>i.titulo===info.titulo)){
      const cat=ROTINA_NOMES[r]||info.titulo;
      insights.push({...info,acao:()=>abrirModalGastoCategoria(cat),btnLabel:'Registrar gasto →'});
      perfilCount++;
    }
  }

  // ── Insight de transporte ────────────────────────────────
  const transporte=vida.transporte||[];
  if(transporte.includes('moto')&&!insights.some(i=>i.titulo==='Moto no perfil'))
    insights.push({png:'icone-moto.png',bg:'rgba(245,158,11,0.1)',titulo:'Moto no perfil',desc:'Registre gastos com gasolina, manutenção e seguro da moto.',acao:()=>abrirModalGastoCategoria('Moto'),btnLabel:'Registrar gasto →'});
  if(transporte.includes('carro')&&!insights.some(i=>i.titulo==='Carro no perfil'))
    insights.push({png:'icone-carro.png',bg:'rgba(100,116,139,0.1)',titulo:'Carro no perfil',desc:'Não esqueça de registrar combustível, manutenção e IPVA.',acao:()=>abrirModalGastoCategoria('Carro'),btnLabel:'Registrar gasto →'});

  // ── Insight de família ───────────────────────────────────
  if(vida.filhos==='sim')
    insights.push({png:'icone-bebe.png',bg:'rgba(236,72,153,0.1)',titulo:'Bebê / Criança',desc:'Registre os gastos com bebê para acompanhar o impacto no orçamento.',acao:()=>abrirModalGastoCategoria('Bebê / Criança'),btnLabel:'Registrar gasto →'});
  const familia=vida.familia||[];
  if(familia.includes('pets'))
    insights.push({png:'icone-pets.png',bg:'rgba(245,158,11,0.1)',titulo:'Pets no perfil',desc:'Registre gastos com pets — ração, veterinário, banho e tosa.',acao:()=>abrirModalGastoCategoria('Pets'),btnLabel:'Registrar gasto →'});

  // Insight reserva emergência se saldo baixo
  const saldoAtual=ent-sai;
  const gastosMes=sai;
  if(saldoAtual<gastosMes*3&&saldoAtual>=0)
    insights.push({png:'icone-score-bom.png',bg:'rgba(16,185,129,0.1)',titulo:'Construa sua reserva de emergência',desc:'O ideal é ter 3–6 meses de despesas guardados. Sua reserva atual é muito baixa.',acao:()=>irPara('metas'),btnLabel:'Criar meta de reserva →'});

  if(insights.length===0){panel.style.display='none';return;}
  panel.style.display='block';
  if(cEl)cEl.textContent=`${insights.length} insights`;
  // Armazena as funções acao num array global para acesso via onclick
  window._insightAcoes = insights.map(i => i.acao || null);

  list.innerHTML=insights.map((i, idx)=>{
    const isUrgente=i.bg.includes('239,68,68')||i.bg.includes('245,158,11');
    const tagCor=isUrgente?'#ef4444':'#3b82f6';
    const tagTxt=isUrgente?'⚠ URGENTE':'💡 SAIBA MAIS';
    const borderColor=isUrgente?'rgba(239,68,68,0.2)':'rgba(59,130,246,0.12)';
    const callAcao = `if(window._insightAcoes&&window._insightAcoes[${idx}])window._insightAcoes[${idx}]()`;
    return `<div class="insight-card" style="background:${i.bg};border:1px solid ${borderColor}" onclick="${callAcao}">
      <img src="${i.png}" alt="" class="insight-icon" onerror="this.style.display='none'">
      <div class="insight-body">
        <div class="insight-tag" style="color:${tagCor}">${tagTxt}</div>
        <div class="insight-titulo">${i.titulo}</div>
        <div class="insight-desc">${i.desc}</div>
      </div>
      ${i.btnLabel?`<button class="insight-acao" style="border-color:${borderColor};color:${tagCor}" onclick="event.stopPropagation();${callAcao}">${i.btnLabel}</button>`:''}
    </div>`;
  }).join('');
}

// ── Abrir modal de gasto com categoria pré-selecionada ──────────────
window.abrirModalGastoCategoria = function(categoria) {
  // Abrir modal de novo gasto
  const btnGasto = document.getElementById('btn-novo-gasto') || document.querySelector('[onclick*="abrirModal"]');
  // Simular clique no botão Novo Gasto
  if(typeof window.abrirModal === 'function') window.abrirModal('gasto');
  else if(typeof window.abrirModalGasto === 'function') window.abrirModalGasto();
  // Aguardar modal abrir e pré-selecionar categoria
  setTimeout(() => {
    const selCat = document.getElementById('modal-categoria');
    if(selCat) {
      selCat.value = categoria;
      // Disparar evento para picker atualizar
      selCat.dispatchEvent(new Event('change'));
    }
    // Picker visual
    const picker = document.getElementById('modal-categoria-picker');
    if(picker) {
      picker.querySelectorAll('.cat-picker-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.val === categoria);
      });
    }
  }, 150);
};

// ── Ocultar Insights ─────────────────────────────────────────────
window.ocultarInsights = function() {
  const panel = document.getElementById('insights-panel');
  if (panel) {
    panel.style.animation = 'fadeOutUp .25s ease';
    setTimeout(() => { panel.style.display = 'none'; panel.style.animation = ''; }, 240);
  }
};

// ── Sugestão 50-30-20 ────────────────────────────────────────────
function renderSugestaoOrcamento(){
  const el=document.getElementById('sugestao-orcamento');
  if(!el) return;
  // Usar renda do perfil ou estimar pelas entradas do mês atual
  let renda=perfilUsuario?.renda||0;
  if(renda<=0){
    const agora=new Date();
    renda=movimentacoes
      .filter(m=>m.tipo==='ganho'&&m.data&&
        new Date(m.data+'T00:00:00').getMonth()===agora.getMonth()&&
        new Date(m.data+'T00:00:00').getFullYear()===agora.getFullYear())
      .reduce((s,m)=>s+(m.valor||0),0);
  }
  if(renda<=0){el.style.display='none';return;}
  const necessidades=Math.round(renda*0.50);
  const desejos=Math.round(renda*0.30);
  const futuro=Math.round(renda*0.20);
  const agora=new Date();
  const gastosMes=movimentacoes
    .filter(m=>m.tipo==='gasto'&&naoEQuitacao(m)&&m.data&&new Date(m.data+'T00:00:00').getMonth()===agora.getMonth()&&new Date(m.data+'T00:00:00').getFullYear()===agora.getFullYear())
    .reduce((s,m)=>s+m.valor,0);
  const pctGasto=Math.min(100,Math.round((gastosMes/(renda*0.80))*100));
  el.style.display='block';
  el.innerHTML=`<div class="orcamento-sugestao">
    <div class="orcamento-sugestao-titulo">
      <span><img src="icone-grafico-01.png" style="width:28px;height:28px;object-fit:contain;vertical-align:middle"></span>
      Sugestão 50·30·20 — baseada na sua renda de ${fmt(renda)}/mês
      <div style="margin-left:auto;font-size:.72rem;color:var(--gray);font-weight:400">Gastos este mês: <strong style="color:${pctGasto>=100?'#ef4444':pctGasto>=75?'#f59e0b':'var(--primary)'}">${fmt(gastosMes)}</strong></div>
    </div>
    <div class="orcamento-regras">
      <div class="orcamento-regra">
        <div class="orcamento-regra-pct or-verde">50%</div>
        <div class="orcamento-regra-label">Necessidades<br>moradia, alimentação...</div>
        <div class="orcamento-regra-val or-verde">${fmt(necessidades)}</div>
      </div>
      <div class="orcamento-regra">
        <div class="orcamento-regra-pct or-azul">30%</div>
        <div class="orcamento-regra-label">Desejos<br>lazer, roupas...</div>
        <div class="orcamento-regra-val or-azul">${fmt(desejos)}</div>
      </div>
      <div class="orcamento-regra">
        <div class="orcamento-regra-pct or-amarelo">20%</div>
        <div class="orcamento-regra-label">Futuro<br>reserva, investimento</div>
        <div class="orcamento-regra-val or-amarelo">${fmt(futuro)}</div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--gray);margin-bottom:4px">
        <span>Progresso de gastos este mês</span>
        <span>${pctGasto}% do orçamento</span>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden">
        <div style="height:100%;width:${pctGasto}%;border-radius:6px;background:${pctGasto>=100?'#ef4444':pctGasto>=75?'#f59e0b':'#22c55e'};transition:width .5s ease"></div>
      </div>
    </div>
  </div>`;
}

// ── Banner Empresa ───────────────────────────────────────────────
function mostrarBannerEmpresa(){
  const resposta=localStorage.getItem('monvy_banner_empresa_resp');
  const modoEmpresa=localStorage.getItem('monvy_modo_empresa');
  // Não mostra só se já respondeu SIM ou NÃO, ou já usa modo empresa
  if(resposta==='nao'||resposta==='sim'||modoEmpresa) return;
  // X apenas fecha — volta a aparecer toda vez que abrir o app
  setTimeout(()=>{
    const el=document.getElementById('banner-empresa');
    if(el){el.style.display='block';el.style.animation='fadeInDown .4s ease';}
  },2500);
}
window.fecharBannerEmpresa=function(resposta){
  const el=document.getElementById('banner-empresa');
  if(el){
    el.style.animation='fadeOutUp .3s ease';
    setTimeout(()=>{ el.style.display='none'; },280);
  }
  if(resposta==='sim'){
    // Sim → vai para onboarding e nunca mais aparece
    localStorage.setItem('monvy_banner_empresa_resp','sim');
    setTimeout(()=>{ window.location.href='onboarding_empresa.html'; },300);
  } else if(resposta==='nao'){
    // Não → nunca mais aparece
    localStorage.setItem('monvy_banner_empresa_resp','nao');
  }
  // X → não salva nada, banner volta na próxima abertura do app
};

// ── Banner perfil ─────────────────────────────────────────────────
// ── Dicas do Dia com IA ──────────────────────────────────────────
let _dicasIA = [];
let _dicaIdx = 0;
let _dicasCarregando = false;

const _dicasEstaticas = [
  'Antes de investir, tenha uma reserva de emergência de pelo menos 3 meses de gastos.',
  'LCI e LCA são isentos de IR para pessoa física — ótimos para renda fixa.',
  'A regra 50-30-20: 50% necessidades, 30% desejos, 20% poupança.',
  'Pequenos gastos diários somam muito. R$10/dia = R$3.600/ano.',
  'Invista primeiro, depois gaste o restante — não o contrário.',
  'Cartão de crédito não é extensão de renda. Use só o que você tem.',
  'Revise suas assinaturas mensais — provavelmente tem uma que não usa.',
  'O melhor investimento é quitar dívidas com juros altos primeiro.',
  'Automatize seus investimentos para não depender da disciplina.',
  'Inflação corrói seu dinheiro. Dinheiro parado perde valor todo mês.',
  'Compare preços antes de comprar. A diferença pode surpreender.',
  'Tenha um fundo de emergência separado dos seus investimentos.',
];

async function carregarDicasIA() {
  if (_dicasCarregando) return;
  _dicasCarregando = true;
  const hoje = new Date();
  const idx = hoje.getDate() % _dicasEstaticas.length;
  _dicasIA = [..._dicasEstaticas.slice(idx), ..._dicasEstaticas.slice(0, idx)];
  renderizarDicaAtual();
  try {
    const ctx = typeof klausContexto === 'function' ? klausContexto() : '';
    const sistema = 'Você é educador financeiro do Monvay. Gere 5 dicas financeiras curtas e práticas. Responda APENAS com JSON array: ["dica1","dica2","dica3","dica4","dica5"]. Máximo 120 chars cada. Sem markdown.';
    const resp = await klausChamarCloud(ctx + '\n\nGere 5 dicas financeiras personalizadas para este usuário.', [], sistema);
    const match = resp.match(/\[[\s\S]*?\]/);
    if (match) {
      const dicas = JSON.parse(match[0]);
      if (Array.isArray(dicas) && dicas.length > 0) {
        _dicasIA = [...dicas, ..._dicasEstaticas];
        _dicaIdx = 0;
        renderizarDicaAtual();
      }
    }
  } catch(e) { console.log('Dicas: usando estaticas'); }
  _dicasCarregando = false;
}

function renderizarDicaAtual() {
  const el = document.getElementById('dica-dia-texto');
  const dots = document.getElementById('dica-dots');
  if (!el || _dicasIA.length === 0) return;
  el.style.opacity = '0';
  setTimeout(() => { el.textContent = _dicasIA[_dicaIdx]; el.style.opacity = '1'; el.style.transition = 'opacity .3s'; }, 150);
  if (dots) {
    const total = Math.min(_dicasIA.length, 8);
    dots.innerHTML = Array.from({length: total}, (_, i) =>
      '<div style="width:' + (i===_dicaIdx%total?16:6) + 'px;height:6px;border-radius:3px;background:' + (i===_dicaIdx%total?'var(--primary)':'rgba(255,255,255,0.2)') + ';transition:all .3s"></div>'
    ).join('');
  }
}

window.proximaDica = function() {
  if (_dicasIA.length === 0) return;
  _dicaIdx = (_dicaIdx + 1) % _dicasIA.length;
  renderizarDicaAtual();
};

setInterval(() => {
  const card = document.getElementById('dica-dia-card');
  if (card && card.style.display !== 'none' && _dicasIA.length > 0) window.proximaDica();
}, 15000);

function atualizarBanner(){
  const banner=document.getElementById('banner-rotina-contas'); if(!banner) return;
  const rotina=perfilUsuario?.perfilVida?.rotina||[];
  const nomes={netflix:'Netflix',spotify:'Spotify',youtube:'YouTube Premium',academia:'Academia',internet:'Internet',celular:'Celular',hbo:'Max',prime:'Prime',disney:'Disney+',chatgpt:'ChatGPT Plus',notion:'Notion',canva:'Canva'};
  const gastoFixo=rotina.map(r=>nomes[r]).filter(Boolean);
  if(gastoFixo.length>0){const d=document.getElementById('banner-rotina-desc');if(d)d.textContent=`Detectado: ${gastoFixo.slice(0,3).join(', ')}${gastoFixo.length>3?` e +${gastoFixo.length-3}`:''}`;banner.style.display='flex';}
}

// ── BCB ───────────────────────────────────────────────────────────
async function carregarTaxasBCB(){
  const sEl=document.getElementById('bcb-status-text');const dEl=document.getElementById('bcb-dot');const rEl=document.getElementById('bcb-rates-row');
  try{
    const res=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json');
    const data=await res.json();
    const selicDiaria=parseFloat(data[0]?.valor); // taxa diária em %
    // Converter taxa diária para anual: (1 + d/100)^252 - 1) * 100
    const selicAnual = (Math.pow(1 + selicDiaria/100, 252) - 1) * 100;
    const selic = Math.round(selicAnual * 100) / 100;
    taxasLive={selic,cdi:selic,poupanca:selic<=8.5?selic*0.7:6.17,lci:selic*0.9};
    const sE=document.getElementById('bcb-selic');const cE=document.getElementById('bcb-cdi');const pE=document.getElementById('bcb-poup');const lE=document.getElementById('bcb-lci');
    if(sE)sE.textContent=selic.toFixed(2)+'% a.a.';if(cE)cE.textContent=taxasLive.cdi.toFixed(3)+'% a.m.';
    if(pE)pE.textContent=taxasLive.poupanca.toFixed(2)+'% a.a.';if(lE)lE.textContent=taxasLive.lci.toFixed(2)+'% a.a.';
    if(dEl)dEl.style.background='#22c55e';if(sEl)sEl.textContent='Taxas atualizadas';if(rEl)rEl.style.display='flex';
    const tE=document.getElementById('bcb-update-time');if(tE)tE.textContent=`Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  }catch(e){if(dEl)dEl.style.background='#ef4444';if(sEl)sEl.textContent='Não foi possível buscar as taxas.';taxasLive={selic:14.75,cdi:14.75,poupanca:7.16,lci:14.75*0.9};}
}

// ── Investimentos ─────────────────────────────────────────────────
window.calcularInvestimentos=function(){
  const ini=parseFloat(document.getElementById('inv-inicial').value)||0;
  const apt=parseFloat(document.getElementById('inv-aporte').value)||0;
  const mes=parseInt(document.getElementById('inv-meses').value)||12;
  if(ini<=0&&apt<=0){showToast('Informe um valor inicial ou aporte mensal.','error');return;}
  const selic=taxasLive.selic||13.75;
  const opcoes=[
    {nome:'Tesouro Selic',taxaAnual:selic*0.99-0.2,ir:true,liquidez:'D+1',risco:'Baixo'},
    {nome:'CDB 100% CDI',taxaAnual:selic,ir:true,liquidez:'No vencimento',risco:'Baixo'},
    {nome:'LCI 90% CDI',taxaAnual:selic*0.9,ir:false,liquidez:'No vencimento',risco:'Baixo'},
    {nome:'LCA 90% CDI',taxaAnual:selic*0.9,ir:false,liquidez:'No vencimento',risco:'Baixo'},
    {nome:'Poupança',taxaAnual:taxasLive.poupanca||6.17,ir:false,liquidez:'Diária',risco:'Baixo'},
    {nome:'CDB 120% CDI',taxaAnual:selic*1.2,ir:true,liquidez:'No vencimento',risco:'Baixo'},
  ];
  // Cálculo de juros compostos com aporte mensal
  // Fórmula: M = PV*(1+i)^n + PMT*[((1+i)^n - 1)/i]
  // onde PV=valor inicial, PMT=aporte mensal, i=taxa mensal, n=meses
  function calc(taxaAnual, ir, meses){
    const i = Math.pow(1 + taxaAnual/100, 1/12) - 1; // taxa mensal efetiva
    const fatorPV = Math.pow(1+i, meses);
    const montantePV = ini * fatorPV;
    const montantePMT = apt > 0 ? apt * ((fatorPV - 1) / i) : 0;
    const bruto = montantePV + montantePMT;
    const totInvest = ini + apt * meses;
    const lucro = bruto - totInvest;
    if(ir && lucro > 0){
      // Tabela regressiva IR renda fixa
      const aliq = meses <= 6 ? 0.225 : meses <= 12 ? 0.20 : meses <= 24 ? 0.175 : 0.15;
      return bruto - lucro * aliq;
    }
    return bruto;
  }
  // Retorna bruto e líquido separados para exibição
  function calcDetalhado(taxaAnual, ir, meses){
    const i = Math.pow(1 + taxaAnual/100, 1/12) - 1;
    const fatorPV = Math.pow(1+i, meses);
    const bruto = ini * fatorPV + (apt > 0 ? apt * ((fatorPV-1)/i) : 0);
    const totInvest = ini + apt * meses;
    const lucro = bruto - totInvest;
    let liquido = bruto;
    let irValor = 0;
    if(ir && lucro > 0){
      const aliq = meses <= 6 ? 0.225 : meses <= 12 ? 0.20 : meses <= 24 ? 0.175 : 0.15;
      irValor = lucro * aliq;
      liquido = bruto - irValor;
    }
    return {bruto, liquido, lucro, irValor, totInvest};
  }
  const totInv = ini + apt * mes;
  const res = opcoes.map(o => {
    const d = calcDetalhado(o.taxaAnual, o.ir, mes);
    return {...o, final: d.liquido, bruto: d.bruto, lucro: d.lucro, irValor: d.irValor};
  }).sort((a,b) => b.final - a.final);
  const melhor = res[0];
  const sEl=document.getElementById('sim-summary');const tiEl=document.getElementById('sim-total-inv');const mnEl=document.getElementById('sim-melhor-nome');const mgEl=document.getElementById('sim-melhor-ganho');
  if(sEl)sEl.style.display='flex';if(tiEl)tiEl.textContent=fmt(totInv);if(mnEl)mnEl.textContent=melhor.nome;if(mgEl)mgEl.textContent='+'+fmt(melhor.final-totInv);
  const wEl=document.getElementById('sim-ranking-wrap');const lEl=document.getElementById('sim-ranking-list');
  if(wEl)wEl.style.display='block';
  if(lEl) lEl.innerHTML=res.map((o,idx2)=>`<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border);background:${idx2===0?'rgba(34,197,94,0.06)':''}"><div style="width:32px;height:32px;border-radius:50%;background:${idx2===0?'var(--primary)':'rgba(255,255,255,0.08)'};display:flex;align-items:center;justify-content:center;font-weight:800;color:${idx2===0?'#000':'var(--text)'};font-size:.9rem;flex-shrink:0">${idx2+1}</div><div style="flex:1"><div style="font-weight:700">${o.nome}</div><div style="font-size:.75rem;color:var(--gray)">${o.taxaAnual.toFixed(2)}% a.a. · ${o.liquidez} · ${o.ir?'c/ IR':'Isento IR'}</div>${o.ir&&o.irValor>0?`<div style="font-size:.72rem;color:#f59e0b">IR: -${fmt(o.irValor)}</div>`:''}</div><div style="text-align:right"><div style="font-weight:800;color:${idx2===0?'#22c55e':'var(--text)'}">${fmt(o.final)}</div><div style="font-size:.75rem;color:#22c55e">+${fmt(o.final-totInv)}</div>${o.ir?`<div style="font-size:.7rem;color:var(--gray)">bruto: ${fmt(o.bruto)}</div>`:''}</div></div>`).join('');
};
window.abrirModalSimulacao=function(){
  const modal=document.getElementById('modal-simulacao');
  if(!modal) return;
  modal.classList.remove('hidden');
  // Renderizar tabela e gráfico de crescimento mês a mês
  const ini=parseBR(document.getElementById('inv-inicial').value)||0;
  const apt=parseBR(document.getElementById('inv-aporte').value)||0;
  const mes=parseInt(document.getElementById('inv-meses').value)||12;
  if(!ini && !apt){ showToast('Preencha pelo menos o valor inicial ou o aporte mensal.','error'); modal.classList.add('hidden'); return; }
  const subheader=document.getElementById('sim-modal-subheader');
  if(subheader) subheader.innerHTML=`<span style="font-size:.82rem;color:var(--gray)">Inicial: <b style="color:var(--white)">${fmt(ini)}</b> · Aporte: <b style="color:var(--white)">${fmt(apt)}/mês</b> · Período: <b style="color:var(--white)">${mes} meses</b></span>`;
  const selic=taxasLive.selic||14.75;
  const melhorTaxa=selic*1.2; // CDB 120% CDI como referência
  const ir=true;
  // Gerar tabela mês a mês
  const i=Math.pow(1+melhorTaxa/100,1/12)-1;
  const rows=[];let saldo=ini;
  for(let m=1;m<=mes;m++){
    const rendimento=saldo*i;
    saldo=saldo*(1+i)+(apt);
    const totInv=ini+apt*m;
    const lucro=Math.max(0,saldo-totInv);
    const aliq=m<=6?.225:m<=12?.20:m<=24?.175:.15;
    const liquido=saldo-lucro*aliq;
    rows.push({m,saldo:liquido,rendimento,totInv});
  }
  const tEl=document.getElementById('sim-tabela');
  if(tEl) tEl.innerHTML=`
    <table style="width:100%;border-collapse:collapse;font-size:.82rem">
      <thead><tr style="color:var(--gray);font-size:.72rem;text-transform:uppercase">
        <th style="text-align:left;padding:8px 4px">Mês</th>
        <th style="text-align:right;padding:8px 4px">Total investido</th>
        <th style="text-align:right;padding:8px 4px">Rendimento</th>
        <th style="text-align:right;padding:8px 4px">Saldo líquido</th>
      </tr></thead>
      <tbody>${rows.filter((_,idx)=>idx%Math.max(1,Math.floor(mes/12))===0||idx===mes-1).map(r=>`
        <tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 4px;color:var(--gray)">Mês ${r.m}</td>
          <td style="padding:8px 4px;text-align:right;color:var(--white)">${fmt(r.totInv)}</td>
          <td style="padding:8px 4px;text-align:right;color:#22c55e">+${fmt(r.rendimento)}</td>
          <td style="padding:8px 4px;text-align:right;font-weight:700;color:#22c55e">${fmt(r.saldo)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  // Gráfico de crescimento
  setTimeout(()=>{
    const canvas=document.getElementById('sim-chart');
    if(canvas){
      if(window._simChart){window._simChart.destroy();window._simChart=null;}
      const labels=rows.filter((_,idx)=>idx%Math.max(1,Math.floor(mes/6))===0||idx===mes-1).map(r=>'M'+r.m);
      const dataSaldo=rows.filter((_,idx)=>idx%Math.max(1,Math.floor(mes/6))===0||idx===mes-1).map(r=>r.saldo);
      const dataTotInv=rows.filter((_,idx)=>idx%Math.max(1,Math.floor(mes/6))===0||idx===mes-1).map(r=>r.totInv);
      const ctx=canvas.getContext('2d');
      const h=canvas.offsetHeight||280;
      const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(34,197,94,0.35)');g.addColorStop(1,'rgba(34,197,94,0)');
      window._simChart=new Chart(ctx,{type:'line',data:{labels,datasets:[
        {label:'Saldo líquido',data:dataSaldo,borderColor:'#22c55e',backgroundColor:g,fill:true,tension:0.4,borderWidth:2,pointRadius:3},
        {label:'Total investido',data:dataTotInv,borderColor:'rgba(255,255,255,0.25)',fill:false,tension:0.4,borderWidth:1.5,borderDash:[5,4],pointRadius:0}
      ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10}}},scales:{x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:10}}},y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:10},callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}});
    }
  },50);
};
window.fecharModalSimulacao=function(){document.getElementById('modal-simulacao')?.classList.add('hidden');};

// ── Bolsa ─────────────────────────────────────────────────────────
const TICKERS_ACOES=['PETR4','VALE3','ITUB4','BBDC4','B3SA3','ABEV3','WEGE3','RENT3','SUZB3','LREN3'];
const TICKERS_FIIS=['MXRF11','HGLG11','KNRI11','XPML11','VISC11','BTLG11'];
const TICKERS_BDRS=['AAPL34','MSFT34','AMZO34','GOGL34','TSLA34'];
async function carregarBolsa(){
  const lE=document.getElementById('bolsa-loading');const eE=document.getElementById('bolsa-erro');const liE=document.getElementById('bolsa-lista');
  if(!liE) return;
  if(lE)lE.style.display='block';if(liE)liE.style.display='none';if(eE)eE.style.display='none';
  const todos=[...TICKERS_ACOES,...TICKERS_FIIS,...TICKERS_BDRS];
  try{
    const res=await fetch(`https://brapi.dev/api/quote/${todos.join(',')}?range=1d&interval=1d&fundamental=false`);
    const data=await res.json();
    bolsaDados=(data.results||[]).map(t=>({symbol:t.symbol,name:t.longName||t.shortName||t.symbol,price:t.regularMarketPrice,change:t.regularMarketChangePercent,tipo:TICKERS_FIIS.includes(t.symbol)?'fiis':TICKERS_BDRS.includes(t.symbol)?'bdrs':'acoes'}));
    if(lE)lE.style.display='none';renderizarBolsa();
  }catch(e){if(lE)lE.style.display='none';if(eE){eE.style.display='block';eE.textContent='Não foi possível carregar os dados da bolsa.';}}
}
window.filtrarBolsa=function(filtro){
  bolsaFiltroAtual=filtro;bolsaMostrados=10;
  document.querySelectorAll('[id^="bolsa-filtro-"]').forEach(b=>{b.style.background='transparent';b.style.color='var(--gray)';b.style.borderColor='var(--border)';});
  const btn=document.getElementById(`bolsa-filtro-${filtro}`);if(btn){btn.style.background='var(--primary)';btn.style.color='#000';btn.style.borderColor='var(--primary)';}
  renderizarBolsa();
};
function renderizarBolsa(){
  const liE=document.getElementById('bolsa-lista');const mE=document.getElementById('bolsa-carregar-mais');
  if(!liE) return;
  const filtrados=bolsaFiltroAtual==='todos'?bolsaDados:bolsaDados.filter(t=>t.tipo===bolsaFiltroAtual);
  const vis=filtrados.slice(0,bolsaMostrados);
  liE.style.display='block';
  liE.innerHTML=vis.map((t,i)=>{const cor=(t.change||0)>=0?'#22c55e':'#ef4444';const sin=(t.change||0)>=0?'+':'';return `<div onclick="abrirModalAtivo('${t.symbol}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:${i<vis.length-1?'1px solid var(--border)':'none'};cursor:pointer;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''"><div><div style="font-weight:800;font-size:.95rem">${t.symbol}</div><div style="font-size:.72rem;color:var(--gray);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</div></div><div style="text-align:right"><div style="font-weight:700">R$ ${(t.price||0).toFixed(2).replace('.',',')}</div><div style="font-size:.82rem;font-weight:700;color:${cor}">${sin}${(t.change||0).toFixed(2).replace('.',',')}%</div></div></div>`;}).join('');
  if(mE)mE.style.display=filtrados.length>bolsaMostrados?'block':'none';
}
window.bolsaMostrarMais=function(){bolsaMostrados+=10;renderizarBolsa();};
window.buscarAtivo=async function(ticker){
  const t=(ticker||'').toUpperCase().trim(); if(!t) return;
  const lE=document.getElementById('b3-loading');const eE=document.getElementById('b3-erro');const rE=document.getElementById('b3-resultado');
  if(lE)lE.style.display='block';if(eE)eE.style.display='none';if(rE)rE.style.display='none';
  try{
    const res=await fetch(`https://brapi.dev/api/quote/${t}`);const data=await res.json();const q=data.results?.[0];
    if(!q)throw new Error('Não encontrado');
    if(lE)lE.style.display='none';
    if(rE){const cor=(q.regularMarketChangePercent||0)>=0?'#22c55e':'#ef4444';rE.style.display='block';rE.innerHTML=`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:1.2rem;font-weight:800">${q.symbol}</div><div style="font-size:.8rem;color:var(--gray)">${q.longName||q.shortName||''}</div></div><div style="text-align:right"><div style="font-size:1.4rem;font-weight:800">R$ ${(q.regularMarketPrice||0).toFixed(2).replace('.',',')}</div><div style="color:${cor};font-weight:700">${(q.regularMarketChangePercent||0)>=0?'+':''}${(q.regularMarketChangePercent||0).toFixed(2)}%</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px;text-align:center"><div><div style="font-size:.7rem;color:var(--gray)">Abertura</div><div style="font-weight:700">R$ ${(q.regularMarketOpen||0).toFixed(2).replace('.',',')}</div></div><div><div style="font-size:.7rem;color:var(--gray)">Mínimo</div><div style="font-weight:700">R$ ${(q.regularMarketDayLow||0).toFixed(2).replace('.',',')}</div></div><div><div style="font-size:.7rem;color:var(--gray)">Máximo</div><div style="font-weight:700">R$ ${(q.regularMarketDayHigh||0).toFixed(2).replace('.',',')}</div></div></div></div>`;}
  }catch(e){if(lE)lE.style.display='none';if(eE){eE.style.display='block';eE.textContent=`Ativo "${t}" não encontrado.`;}}
};
window.abrirModalAtivo=function(symbol){
  const modal=document.getElementById('modal-ativo'); if(!modal) return;
  const d=bolsaDados.find(t=>t.symbol===symbol); if(!d) return;
  modal.classList.remove('hidden');
  const mS=document.getElementById('ma-symbol');const mN=document.getElementById('ma-name');const mP=document.getElementById('ma-preco');const mV=document.getElementById('ma-variacao');
  if(mS)mS.textContent=d.symbol;if(mN)mN.textContent=d.name;
  if(mP)mP.textContent=`R$ ${(d.price||0).toFixed(2).replace('.',',')}`;
  if(mV){const cor=(d.change||0)>=0?'#22c55e':'#ef4444';mV.textContent=`${(d.change||0)>=0?'+':''}${(d.change||0).toFixed(2)}%`;mV.style.color=cor;}
  const gL=document.getElementById('ma-grafico-loading');const gC=document.getElementById('ma-canvas');
  if(gL)gL.style.display='none';if(gC)gC.style.display='none';
};
window.fecharModalAtivo=function(){document.getElementById('modal-ativo')?.classList.add('hidden');};
window.trocarPeriodoAtivo=function(){};

// ── Artigos ───────────────────────────────────────────────────────
const artigos=[
  {titulo:'Reserva de emergência',conteudo:'<h2><img src="icone-cofre.png" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:6px">Reserva de emergência</h2><p>Dinheiro guardado para imprevistos. O ideal é ter de 3 a 6 meses dos seus gastos mensais.</p><p><strong>Onde guardar?</strong> Tesouro Selic, CDB com liquidez diária ou conta remunerada.</p><p>Sem reserva, qualquer imprevisto vira dívida.</p>'},
  {titulo:'Cartão de crédito',conteudo:'<h2><img src="icone-cartao-01.png" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:6px">Cartão de crédito</h2><p>O rotativo cobra mais de 400% ao ano. Sempre pague a fatura total. O limite não é dinheiro seu.</p>'},
  {titulo:'Sair das dívidas',conteudo:'<h2><img src="icone-emprestimo.png" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:6px">Sair das dívidas</h2><p><strong>Avalanche:</strong> Quite as dívidas de maior juros primeiro. <strong>Bola de neve:</strong> Quite as menores primeiro para ganhar motivação. Negocie — credores aceitam descontos de até 70%.</p>'},
  {titulo:'Necessidade vs Desejo',conteudo:'<h2><img src="icone-cerebro.png" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:6px">Necessidade vs Desejo</h2><p>Necessidade: o que você precisa para viver. Desejo: o que quer, mas pode viver sem. Antes de comprar, espere 24 horas.</p>'},
  {titulo:'Regra dos 50-30-20',conteudo:'<h2><img src="icone-grafico-02.png" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:6px">Regra dos 50-30-20</h2><ul><li><strong>50%</strong> — Necessidades</li><li><strong>30%</strong> — Desejos</li><li><strong>20%</strong> — Poupança e investimentos</li></ul>'},
  {titulo:'Como começar a investir',conteudo:'<h2><img src="icone-investimento.png" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:6px">Como começar a investir</h2><p>1. Construa reserva de emergência. 2. Quite dívidas caras. 3. Comece pelo Tesouro Direto ou CDB. 4. Invista todo mês, mesmo que pouco.</p>'}
];
window.abrirArtigo=function(idx){const a=artigos[idx];if(!a)return;document.getElementById('artigo-conteudo').innerHTML=a.conteudo;document.getElementById('modal-artigo').classList.remove('hidden');};
window.fecharArtigo=function(){document.getElementById('modal-artigo').classList.add('hidden');};

// ── Perfil vida ───────────────────────────────────────────────────
window.selecionarVida=function(el,categoria,valor){
  const c=el.closest('[id]')||el.parentElement;
  c.querySelectorAll('.vida-opt:not(.multi)').forEach(o=>o.classList.remove('selected'));
  el.classList.toggle('selected');
  _inicializarRascunho();
  window._perfilVidaTemp[categoria]=valor;
};
window.selecionarVidaMulti=function(el,categoria,valor){
  el.classList.toggle('selected');
  _inicializarRascunho();
  if(!window._perfilVidaTemp[categoria]) window._perfilVidaTemp[categoria]=[];
  const arr=window._perfilVidaTemp[categoria];const idx=arr.indexOf(valor);
  if(idx>=0)arr.splice(idx,1);else arr.push(valor);
};
window.adicionarCustomVida=function(tipo,inputEl){
  const val=inputEl.value.trim(); if(!val) return;
  _inicializarRascunho();
  if(!window._perfilVidaTemp.rotina) window._perfilVidaTemp.rotina=[];
  // Evitar duplicatas
  if(window._perfilVidaTemp.rotina.includes(val)) { inputEl.value=''; return; }
  window._perfilVidaTemp.rotina.push(val);
  const tE=document.getElementById(`idx-custom-${tipo}-tags`);
  if(tE) tE.innerHTML+=`<span style="background:rgba(0,200,83,0.15);border:1px solid rgba(0,200,83,0.3);border-radius:20px;padding:3px 10px;font-size:.75rem;color:var(--primary);cursor:pointer" onclick="removerCustomVida('${val}',this,'${tipo}')">${val} ×</span>`;
  inputEl.value='';
};

window.removerCustomVida=function(val,tagEl,tipo){
  _inicializarRascunho();
  if(window._perfilVidaTemp.rotina){
    const idx=window._perfilVidaTemp.rotina.indexOf(val);
    if(idx>=0) window._perfilVidaTemp.rotina.splice(idx,1);
  }
  tagEl.remove();
};
window.salvarPerfilVida=async function(){
  // Garantir que o rascunho existe
  const perfil = JSON.parse(JSON.stringify(window._perfilVidaTemp || perfilUsuario?.perfilVida || {}));

  // 1. Salvar no localStorage imediatamente (nunca falha)
  try { localStorage.setItem('monvy_perfil_vida', JSON.stringify(perfil)); } catch(e){}

  // 2. Atualizar cache em memória
  if(!perfilUsuario) perfilUsuario = {};
  perfilUsuario.perfilVida = perfil;
  window.perfilUsuario = perfilUsuario; // manter window em sincronia
  window._perfilVidaTemp = JSON.parse(JSON.stringify(perfil));

  // 3. Atualizar UI imediatamente — cada chamada isolada para não bloquear caso uma falhe
  try { const sE=document.getElementById('vida-sucesso');if(sE){sE.style.display='block';setTimeout(()=>sE.style.display='none',2000);} } catch(e){}
  try { if(typeof window.showToast==='function') window.showToast('✓ Perfil salvo!','success');
        else if(typeof window.mostrarToastPerfil==='function') window.mostrarToastPerfil('Perfil salvo!'); } catch(e){}
  try { atualizarTelaCategorias(); } catch(e){}
  try { renderizarTabela(); } catch(e){}
  try { if(typeof popularSelectCategorias==='function') popularSelectCategorias('gasto'); } catch(e){}
  try { gerarInsights(); } catch(e){}
  try { atualizarBanner(); } catch(e){}

  // 4. Salvar no Firebase em background (não bloqueia UI)
  if(uidAtual){
    fbSalvarPerfilVida(uidAtual, perfil).catch(e => {
      console.warn('Firebase sync falhou (dados salvos localmente):', e);
    });
  }
};
window.setMetaEco=function(el,pct){
  document.querySelectorAll('#meta-eco-opts .vida-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  if(!window._perfilFinTemp) window._perfilFinTemp={};
  window._perfilFinTemp.metaEconomia=pct;
};
window.salvarPerfilFinancas=async function(){
  if(!uidAtual) return;
  const renda=parseFloat(document.getElementById('perfil-renda').value)||0;
  const extras=window._perfilFinTemp||{};
  try{
    await fbSalvarPerfil(uidAtual,{renda,...extras});perfilUsuario.renda=renda;window._perfilFinTemp=null;
    const sE=document.getElementById('financas-sucesso');if(sE){sE.style.display='block';setTimeout(()=>sE.style.display='none',2000);}
    if(window.mostrarToastPerfil) window.mostrarToastPerfil('Salvo com sucesso!');
  }catch(e){
    console.error('Erro ao salvar perfil vida:', e);
    if(typeof window.showToast==='function') window.showToast('❌ Erro: ' + (e.message||e.code||'Tente novamente'), 'error');
  }
};
window.abrirTabPerfil=function(tab){
  ['conta','vida','financas'].forEach(t=>{
    const tb=document.getElementById(`tab-${t}`);const te=document.getElementById(`perfil-tab-${t}`);
    if(tb)tb.classList.toggle('active',t===tab);if(te)te.style.display=t===tab?'block':'none';
  });
  if(tab==='financas'){const rE=document.getElementById('perfil-renda');if(rE&&perfilUsuario?.renda)rE.value=perfilUsuario.renda;}
};

// Inicializar
renderizarRelatorio();


// ── Registrar implementações para wrappers inline ──────────────
window._salvarPerfilVida_impl = window.salvarPerfilVida;
window._adicionarCustomVida_impl = window.adicionarCustomVida;
window._removerCustomVida_impl = window.removerCustomVida;
window._selecionarVida_impl = window.selecionarVida;
window._selecionarVidaMulti_impl = window.selecionarVidaMulti;
window._abrirTabPerfil_impl = window.abrirTabPerfil;

// ═══════════════════════════════════════════════════════════════
// FASES 1-6 — NÚCLEO MAVEN (sem IA ativa)
// ═══════════════════════════════════════════════════════════════

// ── FASE 2: Níveis de alerta ──────────────────────────────────
const MAVEN_NIVEIS = {
  INSIGHT:  {cor:'#3b82f6',icone:'💡',label:'Insight',  classe:'mv-insight-card mv-insight-oportunidade'},
  ATENCAO:  {cor:'#f59e0b',icone:'⚠️',label:'Atenção', classe:'mv-insight-card mv-insight-alerta'},
  RISCO:    {cor:'#e67e22',icone:'🔶',label:'Risco',    classe:'mv-insight-card mv-insight-risco'},
  CRITICO:  {cor:'#c0392b',icone:'🚨',label:'Crítico',  classe:'mv-insight-card mv-insight-critico'}
};
function criarCardInsightMaven(nivel, titulo, descricao, acao) {
  const n = MAVEN_NIVEIS[nivel] || MAVEN_NIVEIS.INSIGHT;
  return `<div class="${n.classe}" onclick="${acao||''}" style="cursor:pointer">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span>${n.icone}</span>
      <span style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${n.cor}">${n.label}</span>
    </div>
    <div style="font-size:.88rem;font-weight:700;color:#f9f6ef;margin-bottom:4px">${titulo}</div>
    <div style="font-size:.82rem;color:rgba(249,246,239,.7);line-height:1.5">${descricao}</div>
  </div>`;
}
window.criarCardInsightMaven = criarCardInsightMaven;

// ── FASE 1: Memória Maven ─────────────────────────────────────
const MavenMemoria = {
  _sessao: [],
  adicionarSessao(role,content){this._sessao.push({role,content,ts:Date.now()});if(this._sessao.length>20)this._sessao.shift()},
  getSessao(){return this._sessao.slice(-10)},
  salvarOperacional(dados){const atual=this.getOperacional();localStorage.setItem('maven_memoria_operacional',JSON.stringify({...atual,...dados,atualizadoEm:Date.now()}))},
  getOperacional(){try{const r=localStorage.getItem('maven_memoria_operacional');if(!r)return{};const d=JSON.parse(r);if(Date.now()-d.atualizadoEm>30*24*60*60*1000){localStorage.removeItem('maven_memoria_operacional');return{}}return d}catch{return{}}},
  salvarComportamental(p){const a=this.getComportamental();localStorage.setItem('maven_memoria_comportamental',JSON.stringify({...a,...p,atualizadoEm:Date.now()}))},
  getComportamental(){try{const r=localStorage.getItem('maven_memoria_comportamental');return r?JSON.parse(r):{}}catch{return{}}},
  construirContexto(transacoes=[]){
    const op=this.getOperacional();const comp=this.getComportamental();const linhas=[];
    if(op.ultimaAnalise)linhas.push(`Última análise: ${op.ultimaAnalise}`);
    if(comp.categoriaTopGasto)linhas.push(`Categoria top de gasto: ${comp.categoriaTopGasto}`);
    if(comp.tendencia)linhas.push(`Tendência: ${comp.tendencia}`);
    if(!linhas.length)return'';
    return'\n\n🧠 MEMÓRIA MAVEN\n'+linhas.join('\n');
  },
  atualizarPadroes(txs=[]){
    const hoje=new Date();const m=hoje.getMonth();const a=hoje.getFullYear();
    const txMes=txs.filter(t=>{const d=new Date(t.data||Date.now());return d.getMonth()===m&&d.getFullYear()===a});
    const saidas=txMes.filter(t=>t.tipo==='saida'||t.tipo==='gasto');
    const entradas=txMes.filter(t=>t.tipo==='entrada'||t.tipo==='ganho');
    const cats={};saidas.forEach(t=>{const c=t.categoria||'Outros';cats[c]=(cats[c]||0)+Math.abs(t.valor||0)});
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
    const totS=saidas.reduce((s,t)=>s+Math.abs(t.valor||0),0);
    const totE=entradas.reduce((s,t)=>s+Math.abs(t.valor||0),0);
    this.salvarComportamental({categoriaTopGasto:top?top[0]:null,mediaMensalGastos:totS,tendencia:totS>totE?'gastos acima da renda':'dentro do orçamento',atualizadoEm:Date.now()});
    this.salvarOperacional({ultimaAnalise:hoje.toLocaleDateString('pt-BR')});
  }
};
window.MavenMemoria = MavenMemoria;

// ── FASE 2: Motor Proativo ────────────────────────────────────
const MavenProativo = {
  gerarAlertas(txs=[],saldo=0,metas=[]){
    const alertas=[];const hoje=new Date();const m=hoje.getMonth();const a=hoje.getFullYear();
    const mAnt=m===0?11:m-1;const aAnt=m===0?a-1:a;
    const txMes=txs.filter(t=>{const d=new Date(t.data||Date.now());return d.getMonth()===m&&d.getFullYear()===a});
    const txAnt=txs.filter(t=>{const d=new Date(t.data||Date.now());return d.getMonth()===mAnt&&d.getFullYear()===aAnt});
    const saidasMes=txMes.filter(t=>t.tipo==='saida'||t.tipo==='gasto').reduce((s,t)=>s+Math.abs(t.valor||0),0);
    const saidasAnt=txAnt.filter(t=>t.tipo==='saida'||t.tipo==='gasto').reduce((s,t)=>s+Math.abs(t.valor||0),0);
    const entradasMes=txMes.filter(t=>t.tipo==='entrada'||t.tipo==='ganho').reduce((s,t)=>s+Math.abs(t.valor||0),0);
    if(saldo<0)alertas.push({nivel:'CRITICO',titulo:'Saldo negativo detectado',descricao:`Seu saldo está em -R$ ${Math.abs(saldo).toFixed(2)}. Ação imediata necessária.`,acao:"irPara('movimentos')"});
    if(saldo>0&&saidasMes>0){const dias=hoje.getDate();const gd=saidasMes/dias;const dr=Math.floor(saldo/gd);if(dr<=7&&dr>0)alertas.push({nivel:'RISCO',titulo:`Caixa para ~${dr} dias`,descricao:`No ritmo atual, seu saldo cobre apenas ${dr} dias.`,acao:"irPara('movimentos')"})}
    if(saidasAnt>0){const v=((saidasMes-saidasAnt)/saidasAnt)*100;if(v>=20)alertas.push({nivel:'ATENCAO',titulo:`Gastos ${v.toFixed(0)}% acima do mês passado`,descricao:`Você gastou R$ ${(saidasMes-saidasAnt).toFixed(2)} a mais.`,acao:"irPara('gastos')"})}
    if(entradasMes===0&&hoje.getDate()>10)alertas.push({nivel:'ATENCAO',titulo:'Nenhuma entrada registrada',descricao:`Dia ${hoje.getDate()} sem receitas registradas.`,acao:''});
    const cats={};txMes.filter(t=>t.tipo==='saida'||t.tipo==='gasto').forEach(t=>{const c=t.categoria||'Outros';cats[c]=(cats[c]||0)+Math.abs(t.valor||0)});
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
    if(top&&saidasMes>0){const p=((top[1]/saidasMes)*100).toFixed(0);if(p>=35)alertas.push({nivel:'INSIGHT',titulo:`${top[0]} concentra ${p}% dos gastos`,descricao:`R$ ${top[1].toFixed(2)} em ${top[0]}. Normal para seu perfil?`,acao:"irPara('gastos')"})}
    return alertas;
  },
  renderizarFeed(alertas,elementId='maven-feed-alertas'){
    const el=document.getElementById(elementId);if(!el)return;
    if(!alertas.length){el.innerHTML='<div style="padding:12px;text-align:center;color:rgba(249,246,239,.5);font-size:.82rem">✨ Suas finanças estão sob controle.</div>';return}
    el.innerHTML=alertas.map(a=>criarCardInsightMaven(a.nivel,a.titulo,a.descricao,a.acao)).join('');
  }
};
window.MavenProativo = MavenProativo;

// ── FASE 5: Previsão Financeira ───────────────────────────────
const MavenPrevisao = {
  projetarSaldo(saldoAtual,txs=[],dias=30){
    const hoje=new Date();
    const tx30=txs.filter(t=>(hoje-new Date(t.data||Date.now()))<=30*24*60*60*1000);
    const sd=tx30.filter(t=>t.tipo==='saida'||t.tipo==='gasto').reduce((s,t)=>s+Math.abs(t.valor||0),0)/30;
    const ed=tx30.filter(t=>t.tipo==='entrada'||t.tipo==='ganho').reduce((s,t)=>s+Math.abs(t.valor||0),0)/30;
    const proj=saldoAtual+(ed-sd)*dias;
    const dpn=sd>ed?Math.floor(saldoAtual/(sd-ed)):null;
    return{saldo30:proj,saldo60:saldoAtual+(ed-sd)*60,diasParaNegativo:dpn,tendencia:ed>=sd?'positiva':'negativa'};
  }
};
window.MavenPrevisao = MavenPrevisao;

// ── FASE 6: Automações Inteligentes ──────────────────────────
const MavenAutomacoes = {
  _mapa:{'ifood':'Alimentação','uber eats':'Alimentação','rappi':'Alimentação','mcdonalds':'Alimentação','mercado':'Alimentação','supermercado':'Alimentação','farmácia':'Saúde','remédio':'Saúde','médico':'Saúde','academia':'Saúde','aluguel':'Moradia','energia':'Moradia','água':'Moradia','internet':'Moradia','netflix':'Streaming','spotify':'Streaming','amazon prime':'Streaming','disney':'Streaming','uber':'Transporte','gasolina':'Transporte','combustível':'Transporte','das':'Impostos','simples':'Impostos','imposto':'Impostos','salário':'Salário','freela':'Renda Variável','cliente':'Renda Variável'},
  categorizarAutomaticamente(desc){if(!desc)return null;const d=desc.toLowerCase();for(const[k,v]of Object.entries(this._mapa)){if(d.includes(k))return v}return null}
};
window.MavenAutomacoes = MavenAutomacoes;

// ── FASE 33: Placar Financeiro ────────────────────────────────
function atualizarPlacarFinanceiro(){
  const txs=window._transacoesCache||window._movimentos||[];
  const saldo=window._saldoAtual||0;
  const metas=window._metasCache||[];
  const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
  const hoje=new Date();const m=hoje.getMonth();const a=hoje.getFullYear();
  const txMes=txs.filter(t=>{const d=new Date(t.data||Date.now());return d.getMonth()===m&&d.getFullYear()===a});
  const ent=txMes.filter(t=>t.tipo==='entrada'||t.tipo==='ganho').reduce((s,t)=>s+Math.abs(t.valor||0),0);
  const sai=txMes.filter(t=>t.tipo==='saida'||t.tipo==='gasto').reduce((s,t)=>s+Math.abs(t.valor||0),0);
  const res=ent-sai;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  // Semáforo resultado
  const semRes=document.getElementById('sem-resultado');
  if(semRes){
    if(ent===0&&sai===0){semRes.className='mv-semaforo';set('sem-resultado-val','–');set('sem-resultado-desc','Sem movimentações')}
    else if(res>=0){semRes.className='mv-semaforo verde';set('sem-resultado-val',fmt(res)+' de sobra');set('sem-resultado-desc','Você está lucrando este mês.')}
    else{semRes.className='mv-semaforo vermelho';set('sem-resultado-val',fmt(Math.abs(res))+' negativo');set('sem-resultado-desc','Gastos acima das receitas.')}
  }
  // Semáforo caixa
  const semCaixa=document.getElementById('sem-caixa');
  if(semCaixa){
    if(saldo<0){semCaixa.className='mv-semaforo vermelho';set('sem-caixa-val','Negativo');set('sem-caixa-desc',`Saldo: ${fmt(saldo)}`)}
    else if(saldo<sai*0.3){semCaixa.className='mv-semaforo amarelo';set('sem-caixa-val','Atenção');set('sem-caixa-desc',`Reserva baixa: ${fmt(saldo)}`)}
    else{semCaixa.className='mv-semaforo verde';set('sem-caixa-val','Saudável');set('sem-caixa-desc',`Saldo: ${fmt(saldo)}`)}
  }
  // Semáforo metas
  const semMetas=document.getElementById('sem-metas');
  if(semMetas){
    const ativas=metas.filter(m=>m.status!=='concluida');
    if(!ativas.length){semMetas.className='mv-semaforo';set('sem-metas-val','Sem metas');set('sem-metas-desc','Crie uma meta para acompanhar.')}
    else{
      const ok=ativas.filter(m=>(m.atual||0)>=(m.valor*0.5)).length;
      const p=(ok/ativas.length)*100;
      if(p>=70){semMetas.className='mv-semaforo verde';set('sem-metas-val','No caminho');set('sem-metas-desc',`${ativas.length} meta(s) ativa(s)`)}
      else{semMetas.className='mv-semaforo amarelo';set('sem-metas-val','Atenção');set('sem-metas-desc','Metas precisam de reforço.')}
    }
  }
  // Feed de alertas
  const alertas=MavenProativo.gerarAlertas(txs,saldo,metas);
  MavenProativo.renderizarFeed(alertas,'maven-feed-alertas');
  MavenMemoria.atualizarPadroes(txs);
}
window.atualizarPlacarFinanceiro = atualizarPlacarFinanceiro;

// ── FASE 24: Equipe ───────────────────────────────────────────
const MavenEquipe = {
  _membros:[],
  carregar(uid){const r=localStorage.getItem('maven_equipe_'+uid);this._membros=r?JSON.parse(r):[];return this._membros},
  salvar(uid,m){const id=m.id||'mb_'+Date.now();const novo={...m,id};const i=this._membros.findIndex(x=>x.id===id);if(i>=0)this._membros[i]=novo;else this._membros.push(novo);localStorage.setItem('maven_equipe_'+uid,JSON.stringify(this._membros));return novo},
  remover(uid,id){this._membros=this._membros.filter(m=>m.id!==id);localStorage.setItem('maven_equipe_'+uid,JSON.stringify(this._membros))},
  renderLista(){
    const el=document.getElementById('equipe-membros-lista');if(!el)return;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('equipe-kpi-total',this._membros.length);
    set('equipe-kpi-admins',this._membros.filter(m=>m.permissao==='administrador').length);
    set('equipe-kpi-membros',this._membros.filter(m=>m.permissao==='membro').length);
    if(!this._membros.length){el.innerHTML='<div class="mv-empty"><div class="mv-empty-icon">👥</div><div class="mv-empty-title">Nenhum membro</div></div>';return}
    const icones={administrador:'👑',membro:'✏️',visualizador:'👁️'};
    const cores={administrador:'var(--monvay-gold)',membro:'var(--color-success)',visualizador:'var(--gray)'};
    el.innerHTML=this._membros.map(m=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${icones[m.permissao]||'👤'}</div>
      <div style="flex:1"><div style="font-size:.88rem;font-weight:700;color:var(--monvay-cream)">${m.cargo||'Sem cargo'}</div><div style="font-size:.75rem;color:var(--gray)">${m.email||'–'}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="mv-badge" style="background:${cores[m.permissao]}22;color:${cores[m.permissao]}">${m.permissao}</span>
        <button onclick="MavenEquipe.remover('${window.uidAtual||''}','${m.id}');MavenEquipe.renderLista()" style="font-size:.65rem;color:var(--gray);background:none;border:none;cursor:pointer">Remover</button>
      </div></div>`).join('');
  }
};
window.MavenEquipe=MavenEquipe;
function enviarConvite(){
  const email=document.getElementById('convite-email')?.value?.trim();
  const permissao=document.getElementById('convite-permissao')?.value;
  const cargo=document.getElementById('convite-cargo')?.value?.trim();
  if(!email)return alert('Informe o e-mail');
  MavenEquipe.salvar(window.uidAtual||'',{email,permissao,cargo,status:'convidado'});
  MavenEquipe.renderLista();
  document.getElementById('modal-convite-card').style.display='none';
  ['convite-email','convite-cargo'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
}
window.enviarConvite=enviarConvite;

// ── FASE 25: Orçamento ────────────────────────────────────────
const MavenOrcamento={
  _orc:[],
  carregar(uid){const r=localStorage.getItem('maven_orcamento_'+uid);this._orc=r?JSON.parse(r):[];return this._orc},
  salvar(uid,item){const id=item.id||'orc_'+Date.now();const novo={...item,id};const i=this._orc.findIndex(o=>o.id===id||o.categoria===item.categoria);if(i>=0)this._orc[i]=novo;else this._orc.push(novo);localStorage.setItem('maven_orcamento_'+uid,JSON.stringify(this._orc));return novo},
  calcularRealizado(txs,periodo='mes'){
    const hoje=new Date();const m=hoje.getMonth();const a=hoje.getFullYear();
    let tx=txs.filter(t=>t.tipo==='saida'||t.tipo==='gasto');
    if(periodo==='mes')tx=tx.filter(t=>{const d=new Date(t.data||Date.now());return d.getMonth()===m&&d.getFullYear()===a});
    const cats={};tx.forEach(t=>{const c=t.categoria||'Outros';cats[c]=(cats[c]||0)+Math.abs(t.valor||0)});
    return cats;
  },
  renderLista(txs,periodo='mes'){
    const el=document.getElementById('orcamento-lista');if(!el)return;
    const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
    const real=this.calcularRealizado(txs,periodo);
    const totO=this._orc.reduce((s,o)=>s+(o.valor||0),0);
    const totR=Object.values(real).reduce((s,v)=>s+v,0);
    const dev=totR-totO;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('orc-kpi-total',fmt(totO));set('orc-kpi-realizado',fmt(totR));
    set('orc-kpi-desvio',fmt(Math.abs(dev)));set('orc-kpi-desvio-pct',(dev>=0?'+':'-')+((totO>0?(Math.abs(dev)/totO)*100:0).toFixed(1))+'%');
    const elDev=document.getElementById('orc-kpi-desvio');if(elDev)elDev.style.color=dev>0?'var(--color-alert)':'var(--color-success)';
    if(!this._orc.length){el.innerHTML='<div class="mv-empty" style="padding:16px"><div class="mv-empty-icon">📋</div><div class="mv-empty-desc">Clique em Definir orçamento para começar.</div></div>';return}
    const alertas=[];
    el.innerHTML=this._orc.map(o=>{
      const r=real[o.categoria]||0;const pct=o.valor>0?Math.min(100,(r/o.valor)*100):0;
      const cor=pct>=100?'var(--color-alert)':pct>=80?'var(--color-warning)':'var(--color-success)';
      const st=pct>=100?'Estourado':pct>=80?'Atenção':'OK';
      if(pct>=80)alertas.push({categoria:o.categoria,pct:pct.toFixed(0)});
      return`<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:.85rem;font-weight:600;color:var(--monvay-cream)">${o.categoria}</span><span class="mv-badge" style="background:${cor}22;color:${cor}">${st}</span></div>
        <div class="mv-progress" style="margin-bottom:4px"><div class="mv-progress-fill" style="width:${pct}%;background:${cor}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--gray)"><span>${fmt(r)} realizado</span><span>${fmt(o.valor)} orçado</span></div>
      </div>`;
    }).join('');
    const ac=document.getElementById('orc-alertas-card');const al=document.getElementById('orc-alertas-lista');
    if(ac&&al){ac.style.display=alertas.length?'block':'none';al.innerHTML=alertas.map(a=>`<div class="mv-insight-card mv-insight-alerta" style="margin-bottom:8px"><div style="font-size:.8rem;font-weight:700;color:var(--color-warning)">${a.categoria}</div><div style="font-size:.75rem;color:var(--gray-2)">${a.pct}% do orçamento usado.</div></div>`).join('')}
  }
};
window.MavenOrcamento=MavenOrcamento;
window._orcPeriodo='mes';
function setOrcPeriodo(p,btn){window._orcPeriodo=p;document.querySelectorAll('[onclick*="setOrcPeriodo"]').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');MavenOrcamento.renderLista(window._transacoesCache||window._movimentos||[],p)}
function salvarOrcamento(){const cat=document.getElementById('orc-modal-categoria')?.value;const val=parseFloat(document.getElementById('orc-modal-valor')?.value||0);if(!cat||!val)return alert('Preencha categoria e valor');MavenOrcamento.salvar(window.uidAtual||'',{categoria:cat,valor:val});MavenOrcamento.renderLista(window._transacoesCache||window._movimentos||[],window._orcPeriodo);document.getElementById('modal-orcamento').style.display='none'}
window.setOrcPeriodo=setOrcPeriodo;window.salvarOrcamento=salvarOrcamento;

// ── FASE 26: Centro de Custo ──────────────────────────────────
const MavenCentros={
  _centros:[],
  carregar(uid){const r=localStorage.getItem('maven_centros_'+uid);this._centros=r?JSON.parse(r):[];return this._centros},
  salvar(uid,c){const id=c.id||'cc_'+Date.now();const novo={...c,id};const i=this._centros.findIndex(x=>x.id===id);if(i>=0)this._centros[i]=novo;else this._centros.push(novo);localStorage.setItem('maven_centros_'+uid,JSON.stringify(this._centros));return novo},
  remover(uid,id){this._centros=this._centros.filter(c=>c.id!==id);localStorage.setItem('maven_centros_'+uid,JSON.stringify(this._centros))},
  renderLista(txs=[]){
    const el=document.getElementById('centrocusto-lista');if(!el)return;
    const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
    const gastos={};txs.filter(t=>t.centroCusto).forEach(t=>{gastos[t.centroCusto]=(gastos[t.centroCusto]||0)+Math.abs(t.valor||0)});
    const tot=Object.values(gastos).reduce((s,v)=>s+v,0);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('cc-kpi-total',this._centros.length);set('cc-kpi-total-gasto',fmt(tot));
    let maior=null,maiorV=0;this._centros.forEach(c=>{const v=gastos[c.id]||0;if(v>maiorV){maiorV=v;maior=c.nome}});
    if(maior)set('cc-kpi-maior',maior);
    if(!this._centros.length){el.innerHTML='<div class="mv-empty"><div class="mv-empty-icon">🏢</div><div class="mv-empty-title">Nenhum centro</div></div>';return}
    el.innerHTML=this._centros.map(c=>{
      const g=gastos[c.id]||0;const pct=tot>0?((g/tot)*100).toFixed(1):0;const orc=c.orcamento||0;
      const cor=orc>0?(g>orc?'var(--color-alert)':g>orc*.8?'var(--color-warning)':'var(--color-success)'):'var(--gray)';
      const ti={custo:'💸',lucro:'💰',investimento:'📈'};
      return`<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <div><div style="font-size:.88rem;font-weight:700;color:var(--monvay-cream)">${ti[c.tipo]||'🏢'} ${c.nome}</div>${c.responsavel?`<div style="font-size:.72rem;color:var(--gray)">👤 ${c.responsavel}</div>`:''}</div>
          <div style="text-align:right"><div style="font-size:.9rem;font-weight:700;color:var(--color-caution)">${fmt(g)}</div><div style="font-size:.68rem;color:var(--gray)">${pct}% do total</div></div>
        </div>
        ${orc>0?`<div class="mv-progress" style="margin-bottom:3px"><div class="mv-progress-fill" style="width:${Math.min(100,(g/orc)*100)}%;background:${cor}"></div></div>`:''}
        <button onclick="MavenCentros.remover('${window.uidAtual||''}','${c.id}');MavenCentros.renderLista(window._transacoesCache||[])" style="font-size:.65rem;color:var(--gray);background:none;border:none;cursor:pointer;margin-top:3px;padding:0">Remover</button>
      </div>`;
    }).join('');
  }
};
window.MavenCentros=MavenCentros;
function salvarCentro(){const nome=document.getElementById('cc-modal-nome')?.value?.trim();const tipo=document.getElementById('cc-modal-tipo')?.value||'custo';const orc=parseFloat(document.getElementById('cc-modal-orcamento')?.value||0);const resp=document.getElementById('cc-modal-responsavel')?.value?.trim();if(!nome)return alert('Informe o nome');MavenCentros.salvar(window.uidAtual||'',{nome,tipo,orcamento:orc,responsavel:resp});MavenCentros.renderLista(window._transacoesCache||window._movimentos||[]);document.getElementById('modal-centro-card').style.display='none'}
window.salvarCentro=salvarCentro;

// ── FASE 35: Funil de Vendas ──────────────────────────────────
const MavenFunil={
  _leads:[],_etapaFiltro:'todas',
  _prob:{lead:10,contato:25,proposta:50,negociacao:75,fechado:100,perdido:0},
  carregar(uid){const r=localStorage.getItem('maven_funil_'+uid);this._leads=r?JSON.parse(r):[];return this._leads},
  salvar(uid,l){const id=l.id||'ld_'+Date.now();const novo={...l,id,prob:l.probabilidade||this._prob[l.etapa]||50,atualizadoEm:Date.now(),criadoEm:l.criadoEm||Date.now()};const i=this._leads.findIndex(x=>x.id===id);if(i>=0)this._leads[i]=novo;else this._leads.push(novo);localStorage.setItem('maven_funil_'+uid,JSON.stringify(this._leads));if(novo.etapa==='fechado'&&novo.valor>0)this._gerarLancamento(uid,novo);return novo},
  remover(uid,id){this._leads=this._leads.filter(l=>l.id!==id);localStorage.setItem('maven_funil_'+uid,JSON.stringify(this._leads))},
  _gerarLancamento(uid,l){const raw=localStorage.getItem('maven_contas_'+uid);const contas=raw?JSON.parse(raw):[];if(contas.some(c=>c.leadId===l.id))return;const v=new Date(Date.now()+30*24*60*60*1000).toISOString().split('T')[0];contas.push({id:'cr_'+Date.now(),tipo:'receber',descricao:`Fechamento — ${l.nome}`,valor:l.valor,vencimento:v,leadId:l.id,paga:false});localStorage.setItem('maven_contas_'+uid,JSON.stringify(contas));window._contasCache=contas},
  calcularKPIs(){
    const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
    const hoje=new Date();const m=hoje.getMonth();const a=hoje.getFullYear();
    const ab=this._leads.filter(l=>l.etapa!=='fechado'&&l.etapa!=='perdido');
    const fMes=this._leads.filter(l=>{if(l.etapa!=='fechado')return false;const d=new Date(l.atualizadoEm||Date.now());return d.getMonth()===m&&d.getFullYear()===a});
    const pipe=ab.reduce((s,l)=>s+(l.valor||0),0);
    const proj=ab.reduce((s,l)=>s+(l.valor||0)*((l.prob||l.probabilidade||0)/100),0);
    const fVal=fMes.reduce((s,l)=>s+(l.valor||0),0);
    const tot=this._leads.filter(l=>l.etapa!=='perdido').length;
    const fech=this._leads.filter(l=>l.etapa==='fechado').length;
    const conv=tot>0?((fech/tot)*100).toFixed(0):0;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('funil-kpi-pipeline',fmt(pipe));set('funil-kpi-pipeline-qtd',ab.length+' oportunidade(s)');
    set('funil-kpi-projetada',fmt(proj));set('funil-kpi-fechados',fmt(fVal));
    set('funil-kpi-fechados-qtd',fMes.length+' negócio(s)');set('funil-kpi-conversao',conv+'%');
  },
  renderLista(){
    const el=document.getElementById('funil-lista');if(!el)return;
    this.calcularKPIs();
    const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
    let leads=[...this._leads];if(this._etapaFiltro!=='todas')leads=leads.filter(l=>l.etapa===this._etapaFiltro);
    leads.sort((a,b)=>(b.atualizadoEm||0)-(a.atualizadoEm||0));
    if(!leads.length){el.innerHTML='<div class="mv-empty"><div class="mv-empty-icon">🔻</div><div class="mv-empty-title">Nenhum lead</div><div class="mv-empty-desc">Adicione leads ou mude o filtro.</div></div>';return}
    const cfg={lead:{e:'🎯',c:'var(--gray)',l:'Lead'},contato:{e:'📞',c:'var(--color-warning)',l:'Contato'},proposta:{e:'📋',c:'var(--color-caution)',l:'Proposta'},negociacao:{e:'🤝',c:'var(--monvay-gold)',l:'Negociação'},fechado:{e:'✅',c:'var(--color-success)',l:'Fechado'},perdido:{e:'❌',c:'var(--color-alert)',l:'Perdido'}};
    const uid=window.uidAtual||'';
    el.innerHTML=leads.map(l=>{
      const c=cfg[l.etapa]||cfg.lead;const dias=Math.ceil((Date.now()-(l.criadoEm||Date.now()))/(1000*60*60*24));
      return`<div style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="flex:1;min-width:0"><div style="font-size:.88rem;font-weight:700;color:var(--monvay-cream)">${l.nome||'Lead'}</div><div style="font-size:.7rem;color:var(--gray)">${dias}d no pipeline</div></div>
          <div style="text-align:right;flex-shrink:0;margin-left:8px"><div style="font-family:var(--font-title);font-size:.9rem;font-weight:700;color:var(--monvay-cream)">${fmt(l.valor||0)}</div></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="mv-badge" style="background:${c.c}22;color:${c.c}">${c.e} ${c.l}</span>
          <div style="display:flex;gap:4px">
            ${l.etapa!=='fechado'&&l.etapa!=='perdido'?`<button onclick="avancarEtapaFunil('${l.id}')" style="font-size:.65rem;padding:3px 7px;border-radius:6px;border:1px solid var(--monvay-gold);background:transparent;color:var(--monvay-gold);cursor:pointer">Avançar</button><button onclick="fecharNegocio('${l.id}')" style="font-size:.65rem;padding:3px 7px;border-radius:6px;border:1px solid var(--color-success);background:transparent;color:var(--color-success);cursor:pointer">Fechar</button>`:''}
            <button onclick="MavenFunil.remover('${uid}','${l.id}');MavenFunil.renderLista()" style="font-size:.65rem;padding:3px 7px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--gray);cursor:pointer">×</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
};
window.MavenFunil=MavenFunil;
function setEtapaFunil(e,btn){MavenFunil._etapaFiltro=e;document.querySelectorAll('[onclick*="setEtapaFunil"]').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');MavenFunil.renderLista()}
function salvarLead(){const nome=document.getElementById('funil-nome')?.value?.trim();const valor=parseFloat(document.getElementById('funil-valor')?.value||0);const etapa=document.getElementById('funil-etapa')?.value||'lead';const prob=parseInt(document.getElementById('funil-probabilidade')?.value||50);const resp=document.getElementById('funil-responsavel')?.value?.trim();if(!nome)return alert('Informe o nome do lead');MavenFunil.salvar(window.uidAtual||'',{nome,valor,etapa,probabilidade:prob,responsavel:resp});MavenFunil.renderLista();document.getElementById('form-funil').style.display='none';['funil-nome','funil-valor','funil-probabilidade','funil-responsavel'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''})}
function avancarEtapaFunil(id){const ordem=['lead','contato','proposta','negociacao','fechado'];const l=MavenFunil._leads.find(x=>x.id===id);if(!l)return;const i=ordem.indexOf(l.etapa);if(i<ordem.length-1){MavenFunil.salvar(window.uidAtual||'',{...l,etapa:ordem[i+1],probabilidade:MavenFunil._prob[ordem[i+1]]});MavenFunil.renderLista()}}
function fecharNegocio(id){const l=MavenFunil._leads.find(x=>x.id===id);if(!l)return;MavenFunil.salvar(window.uidAtual||'',{...l,etapa:'fechado',probabilidade:100});MavenFunil.renderLista();const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);const n=document.createElement('div');n.style.cssText='position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--surface-3);border-radius:14px;padding:16px 20px;box-shadow:var(--shadow-elevated);max-width:280px;border-left:4px solid var(--color-success);animation:mvFadeUp .3s ease';n.innerHTML=`<div style="font-size:1.4rem;margin-bottom:4px">🎉</div><div style="font-family:var(--font-title);font-weight:700;color:var(--monvay-cream)">Negócio fechado!</div><div style="font-size:.82rem;color:var(--gray-2)">${l.nome} — ${fmt(l.valor||0)}</div>`;document.body.appendChild(n);setTimeout(()=>n.remove(),3500)}
window.setEtapaFunil=setEtapaFunil;window.salvarLead=salvarLead;window.avancarEtapaFunil=avancarEtapaFunil;window.fecharNegocio=fecharNegocio;

// ── FASE 38: Interface Final ──────────────────────────────────
const MavenInterface={
  mostrarFeedback(msg,tipo='success',dur=2500){
    const cores={success:'var(--color-success)',warning:'var(--color-warning)',error:'var(--color-alert)',info:'var(--monvay-gold)'};
    const icones={success:'✓',warning:'⚠',error:'✕',info:'ℹ'};
    const n=document.createElement('div');
    n.style.cssText=`position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--surface-3);border-radius:10px;padding:10px 18px;box-shadow:var(--shadow-elevated);display:flex;align-items:center;gap:8px;border-left:3px solid ${cores[tipo]};animation:mvFadeUp .25s ease;white-space:nowrap;font-family:var(--font-body);font-size:.85rem;color:var(--monvay-cream)`;
    n.innerHTML=`<span style="color:${cores[tipo]};font-weight:700">${icones[tipo]}</span> ${msg}`;
    document.body.appendChild(n);
    setTimeout(()=>{n.style.opacity='0';n.style.transition='opacity .3s';setTimeout(()=>n.remove(),300)},dur);
  }
};
window.MavenInterface=MavenInterface;
window.showSuccess=msg=>MavenInterface.mostrarFeedback(msg,'success');
window.showError=msg=>MavenInterface.mostrarFeedback(msg,'error');
window.showWarning=msg=>MavenInterface.mostrarFeedback(msg,'warning');

// ── FASE 39: Investimentos ────────────────────────────────────
const MavenInvestidor={
  _carteira:[],_perfil:null,_respostasQuiz:{},
  _quiz:[
    {id:'objetivo',pergunta:'Qual o seu principal objetivo ao investir?',opcoes:[{v:1,t:'Proteger da inflação'},{v:2,t:'Crescer no longo prazo'},{v:3,t:'Gerar renda passiva'},{v:4,t:'Juntar para um objetivo'}]},
    {id:'horizonte',pergunta:'Em quanto tempo pode precisar do dinheiro?',opcoes:[{v:1,t:'Menos de 1 ano'},{v:2,t:'1 a 3 anos'},{v:3,t:'3 a 10 anos'},{v:4,t:'Mais de 10 anos'}]},
    {id:'reacao',pergunta:'Se seus investimentos caíssem 20%, o que faria?',opcoes:[{v:1,t:'Venderia tudo'},{v:2,t:'Ficaria preocupado mas esperaria'},{v:3,t:'Manteria a calma'},{v:4,t:'Compraria mais'}]},
    {id:'experiencia',pergunta:'Como descreve sua experiência com investimentos?',opcoes:[{v:1,t:'Nunca investi / só poupança'},{v:2,t:'Investi em renda fixa'},{v:3,t:'Já investi em ações ou FIIs'},{v:4,t:'Carteira diversificada'}]},
    {id:'risco',pergunta:'Que parte do dinheiro toparia em investimentos arriscados?',opcoes:[{v:1,t:'Nenhuma'},{v:2,t:'Até 10%'},{v:3,t:'10% a 30%'},{v:4,t:'Mais de 30%'}]},
  ],
  calcularPerfil(r){const t=Object.values(r).reduce((s,v)=>s+v,0);if(t<=8)return'Iniciante';if(t<=12)return'Conservador';if(t<=16)return'Moderado';return'Arrojado'},
  _aloc:{Iniciante:{rf:60,td:30,fii:10,ac:0},Conservador:{rf:50,td:25,fii:15,ac:10},Moderado:{rf:35,td:15,fii:20,ac:30},Arrojado:{rf:15,td:5,fii:20,ac:60}},
  carregar(uid){const c=localStorage.getItem('maven_carteira_'+uid);this._carteira=c?JSON.parse(c):[];const p=localStorage.getItem('maven_perfil_inv_'+uid);this._perfil=p||null;return this},
  salvarAtivo(uid,a){const id=a.id||'at_'+Date.now();const novo={...a,id};const i=this._carteira.findIndex(x=>x.id===id);if(i>=0)this._carteira[i]=novo;else this._carteira.push(novo);localStorage.setItem('maven_carteira_'+uid,JSON.stringify(this._carteira));return novo},
  removerAtivo(uid,id){this._carteira=this._carteira.filter(a=>a.id!==id);localStorage.setItem('maven_carteira_'+uid,JSON.stringify(this._carteira))},
  salvarPerfil(uid,p){this._perfil=p;if(p)localStorage.setItem('maven_perfil_inv_'+uid,p);else localStorage.removeItem('maven_perfil_inv_'+uid)},
};
window.MavenInvestidor=MavenInvestidor;

function calcularPerfilInvestidor(){
  const r=MavenInvestidor._respostasQuiz;
  if(Object.keys(r).length<5)return alert('Responda todas as 5 perguntas');
  const p=MavenInvestidor.calcularPerfil(r);
  MavenInvestidor.salvarPerfil(window.uidAtual||'',p);
  renderInvPerfil&&renderInvPerfil();
}
window.calcularPerfilInvestidor=calcularPerfilInvestidor;

// ── FASE 40: Histórico Analítico ──────────────────────────────
const MavenHistorico={
  _cache:{},
  _chave(uid,ano_mes){return`${uid}_${ano_mes}`},
  consolidarMes(uid,ano,mes,txs=[],metas=[],saldoFinal=0){
    const ano_mes=`${ano}-${String(mes+1).padStart(2,'0')}`;
    const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
    const txMes=txs.filter(t=>{const d=new Date(t.data||t.criadoEm?.seconds*1000||Date.now());return d.getMonth()===mes&&d.getFullYear()===ano});
    const ent=txMes.filter(t=>t.tipo==='entrada'||t.tipo==='ganho');
    const sai=txMes.filter(t=>t.tipo==='saida'||t.tipo==='gasto');
    const rec=ent.reduce((s,t)=>s+Math.abs(t.valor||0),0);
    const totS=sai.reduce((s,t)=>s+Math.abs(t.valor||0),0);
    const res=rec-totS;const mar=rec>0?(res/rec)*100:0;
    const cats={};sai.forEach(t=>{const c=t.categoria||'Outros';cats[c]=(cats[c]||0)+Math.abs(t.valor||0)});
    const topCats=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([nome,valor])=>({nome,valor,pct:totS>0?((valor/totS)*100).toFixed(1):0}));
    const nomeMes=new Date(ano,mes,1).toLocaleDateString('pt-BR',{month:'long'});
    let narrativa=res>=0?`${nomeMes} foi positivo — resultado de ${fmt(res)}. `:`${nomeMes} ficou negativo em ${fmt(Math.abs(res))}. `;
    if(topCats[0])narrativa+=`Maior gasto: ${topCats[0].nome} com ${fmt(topCats[0].valor)}.`;
    let rec2=res<0?`Reduza gastos com ${topCats[0]?.nome||'categorias principais'}.`:mar<15?'Margem abaixo de 15%. Revise custos variáveis.':`Considere alocar ${fmt(res*.3)} da sobra para reserva.`;
    const resumo={userId:uid,ano_mes,status:'fechado',geradoEm:Date.now(),kpis:{receita:rec,saidas:totS,resultado:res,margem:mar,saldoFinal,qtdEntradas:ent.length,qtdSaidas:sai.length},topCategorias:topCats,narrativa,recomendacao:rec2,metas:(metas||[]).map(m=>({nome:m.nome,valor:m.valor,atual:m.atual||0,atingida:(m.atual||0)>=m.valor}))};
    const chave=this._chave(uid,ano_mes);
    this._cache[chave]=resumo;localStorage.setItem('maven_hist_'+chave,JSON.stringify(resumo));
    try{const{db,doc,setDoc}=window._firebaseExports||{};if(db&&doc&&setDoc)setDoc(doc(db,'financeiro_historico',chave),resumo).catch(()=>{})}catch{}
    return resumo;
  },
  async buscarMes(uid,ano_mes){
    const chave=this._chave(uid,ano_mes);
    if(this._cache[chave])return this._cache[chave];
    const local=localStorage.getItem('maven_hist_'+chave);
    if(local){const p=JSON.parse(local);this._cache[chave]=p;return p}
    try{const{db,doc,getDoc}=window._firebaseExports||{};if(db&&doc&&getDoc){const snap=await getDoc(doc(db,'financeiro_historico',chave));if(snap.exists()){const d=snap.data();this._cache[chave]=d;localStorage.setItem('maven_hist_'+chave,JSON.stringify(d));return d}}}catch{}
    const[ano,mesStr]=ano_mes.split('-');
    return this.consolidarMes(uid,parseInt(ano),parseInt(mesStr)-1,window._transacoesCache||window._movimentos||[],window._metasCache||[],0);
  },
  listarMeses(txs=[]){const m=new Set();txs.forEach(t=>{const d=new Date(t.data||Date.now());m.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)});return Array.from(m).sort().reverse()},
  async compararMeses(uid,m1,m2){
    const[r1,r2]=await Promise.all([this.buscarMes(uid,m1),this.buscarMes(uid,m2)]);
    if(!r1||!r2)return null;
    const d=(a,b)=>b>0?(((a-b)/b)*100).toFixed(1):0;
    return{mes1:m1,mes2:m2,receita:{m1:r1.kpis.receita,m2:r2.kpis.receita,delta:d(r1.kpis.receita,r2.kpis.receita)},saidas:{m1:r1.kpis.saidas,m2:r2.kpis.saidas,delta:d(r1.kpis.saidas,r2.kpis.saidas)},resultado:{m1:r1.kpis.resultado,m2:r2.kpis.resultado,delta:d(r1.kpis.resultado,r2.kpis.resultado)}};
  },
  async fecharMesAuto(uid){
    const ontem=new Date();ontem.setDate(0);const ano=ontem.getFullYear();const mes=ontem.getMonth();const am=`${ano}-${String(mes+1).padStart(2,'0')}`;
    if(localStorage.getItem('maven_hist_'+this._chave(uid,am)))return;
    return this.consolidarMes(uid,ano,mes,window._transacoesCache||window._movimentos||[],window._metasCache||[],window._saldoAtual||0);
  }
};
window.MavenHistorico=MavenHistorico;

// ── Integrar Placar ao render do Dashboard ────────────────────
const _origRenderDB=window.renderDashboardPremium;
if(typeof _origRenderDB==='function'){
  window.renderDashboardPremium=function(){
    _origRenderDB();
    setTimeout(atualizarPlacarFinanceiro,600);
  };
}

// ── Cache de transações para os módulos Maven ─────────────────
const _origRenderDbSaldo=window.renderDbSaldo;
if(typeof _origRenderDbSaldo==='function'){
  window.renderDbSaldo=function(){
    _origRenderDbSaldo();
    try{
      const movs=window._movimentos||[];
      window._transacoesCache=movs;
      const e=movs.filter(t=>t.tipo==='entrada'||t.tipo==='ganho').reduce((s,t)=>s+Math.abs(t.valor||0),0);
      const s=movs.filter(t=>t.tipo==='saida'||t.tipo==='gasto').reduce((s,t)=>s+Math.abs(t.valor||0),0);
      window._saldoAtual=e-s;
    }catch{}
  };
}

// ── Integrar irParaTela com módulos novos ─────────────────────
const _origIrParaTela=window.irParaTela;
if(typeof _origIrParaTela==='function'){
  window.irParaTela=function(tela,btn){
    _origIrParaTela(tela,btn);
    const uid=window.uidAtual||'';
    const txs=window._transacoesCache||window._movimentos||[];
    if(tela==='equipe'){MavenEquipe.carregar(uid);MavenEquipe.renderLista()}
    else if(tela==='orcamento'){MavenOrcamento.carregar(uid);MavenOrcamento.renderLista(txs,window._orcPeriodo||'mes')}
    else if(tela==='centrocusto'){MavenCentros.carregar(uid);MavenCentros.renderLista(txs)}
    else if(tela==='funil'){MavenFunil.carregar(uid);MavenFunil.renderLista()}
  };
}

// ── Auto-fechar mês no dia 1 ──────────────────────────────────
(function(){if(new Date().getDate()===1&&window.uidAtual)setTimeout(()=>MavenHistorico.fecharMesAuto(window.uidAtual),3000)})();

