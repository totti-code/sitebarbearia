/* =========================
   MARTREE SALON MVP (1 salão)
   ========================= */

// 1) COLE AQUI:
const SUPABASE_URL = "https://qdvywfdfalzgjjxigsfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7Ui7z4RjONohMUMFwXb7mg_P4BzzONL";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const fmtBRL = (n) => (Number(n||0)).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const pad = (n)=> String(n).padStart(2,"0");
function toISODate(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function nowLocalDatetime(){
  const d = new Date();
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addMinutes(dtLocalString, minutes){
  const d = new Date(dtLocalString);
  d.setMinutes(d.getMinutes() + Number(minutes||0));
  return d.toISOString();
}
function localToISO(dtLocalString){
  // datetime-local -> Date -> ISO
  return new Date(dtLocalString).toISOString();
}
function isoToHHMM(iso){
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isoToBRDate(iso){
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}
function downloadText(filename, text){
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function getSession(){
  const { data } = await supabaseClient.auth.getSession();
  return data.session || null;
}
async function getMyProfile(){
  const session = await getSession();
  if(!session) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id,nome,role")
    .eq("id", session.user.id)
    .maybeSingle();
  if(error) throw error;
  return data || null;
}
function setMsg(el, text){
  el.textContent = text || "";
}

// ===== Theme =====
const THEME_KEY = "martree_salon_theme_v1";
function loadTheme(){
  const t = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.classList.toggle("light", t === "light");
}
function toggleTheme(){
  const isLight = document.documentElement.classList.contains("light");
  localStorage.setItem(THEME_KEY, isLight ? "dark" : "light");
  loadTheme();
}

// ===== UI refs =====
const viewLogin = $("viewLogin");
const viewApp = $("viewApp");

const whoami = $("whoami");
const btnTheme = $("btnTheme");
const btnLogout = $("btnLogout");

const btnLogin = $("btnLogin");
const btnForgot = $("btnForgot");
const loginEmail = $("loginEmail");
const loginPass = $("loginPass");
const loginMsg = $("loginMsg");

const tabs = Array.from(document.querySelectorAll(".tab"));
const tabViews = {
  agenda: $("tab_agenda"),
  clientes: $("tab_clientes"),
  servicos: $("tab_servicos"),
  profissionais: $("tab_profissionais"),
  caixa: $("tab_caixa"),
};

const pageTitle = $("pageTitle");
const pageSubtitle = $("pageSubtitle");

const btnRefresh = $("btnRefresh");
const btnExportCsv = $("btnExportCsv");

// Agenda inputs
const agendaDay = $("agendaDay");
const filterProf = $("filterProf");
const filterStatus = $("filterStatus");

const agCliente = $("agCliente");
const agProf = $("agProf");
const agServico = $("agServico");
const agInicio = $("agInicio");
const agDur = $("agDur");
const agStatus = $("agStatus");
const agObs = $("agObs");
const btnAgendar = $("btnAgendar");
const agMsg = $("agMsg");
const tblAgendaBody = $("tblAgenda").querySelector("tbody");

// Clientes
const clNome = $("clNome");
const clTel = $("clTel");
const clNiver = $("clNiver");
const clObs = $("clObs");
const btnAddCliente = $("btnAddCliente");
const clMsg = $("clMsg");
const clSearch = $("clSearch");
const tblClientesBody = $("tblClientes").querySelector("tbody");

// Serviços
const svNome = $("svNome");
const svDur = $("svDur");
const svPreco = $("svPreco");
const btnAddServico = $("btnAddServico");
const svMsg = $("svMsg");
const tblServicosBody = $("tblServicos").querySelector("tbody");

// Profissionais
const pfNome = $("pfNome");
const btnAddProf = $("btnAddProf");
const pfMsg = $("pfMsg");
const tblProfBody = $("tblProf").querySelector("tbody");

// Caixa
const cxDe = $("cxDe");
const cxAte = $("cxAte");
const kpiTotal = $("kpiTotal");
const tblCaixaBody = $("tblCaixa").querySelector("tbody");

// ===== State =====
let me = null;
let cache = {
  clientes: [],
  servicos: [],
  profissionais: [],
  agenda: [],
  caixa: [],
};

// ===== Tabs =====
function openTab(key){
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
  Object.entries(tabViews).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));

  const titles = {
    agenda: ["Agenda", "Crie e gerencie atendimentos do dia."],
    clientes: ["Clientes", "Cadastre e consulte clientes."],
    servicos: ["Serviços", "Cadastre serviços com duração e preço (admin)."],
    profissionais: ["Profissionais", "Cadastre profissionais (admin)."],
    caixa: ["Caixa", "Pagamentos e total por período."],
  };
  const [t, s] = titles[key] || ["", ""];
  pageTitle.textContent = t;
  pageSubtitle.textContent = s;

  // ações específicas
  if(key === "caixa") loadCaixa();
  if(key === "agenda") loadAgenda();
}

// ===== Auth =====
async function doLogin(){
  setMsg(loginMsg, "");
  const email = (loginEmail.value || "").trim();
  const pass = loginPass.value || "";
  if(!email || !pass){
    setMsg(loginMsg, "Preencha e-mail e senha.");
    return;
  }
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
  if(error){
    setMsg(loginMsg, error.message);
    return;
  }
  await boot();
}
async function doForgot(){
  setMsg(loginMsg, "");
  const email = (loginEmail.value || "").trim();
  if(!email){
    setMsg(loginMsg, "Digite seu e-mail para enviar o reset.");
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if(error){
    setMsg(loginMsg, error.message);
    return;
  }
  setMsg(loginMsg, "E-mail de recuperação enviado (se existir).");
}
async function doLogout(){
  await supabaseClient.auth.signOut();
  await boot();
}

// ===== Loaders =====
async function loadClientes(){
  const { data, error } = await supabaseClient
    .from("clientes")
    .select("*")
    .order("nome", { ascending:true });
  if(error) throw error;
  cache.clientes = data || [];
  renderClientes();
  fillClientesSelect();
}
async function loadServicos(){
  const { data, error } = await supabaseClient
    .from("servicos")
    .select("*")
    .order("nome", { ascending:true });
  if(error) throw error;
  cache.servicos = data || [];
  renderServicos();
  fillServicosSelect();
}
async function loadProfissionais(){
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("*")
    .order("nome", { ascending:true });
  if(error) throw error;
  cache.profissionais = data || [];
  renderProfissionais();
  fillProfSelects();
}
async function loadAgenda(){
  const day = agendaDay.value || toISODate(new Date());
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59`);

  let q = supabaseClient
    .from("agendamentos")
    .select(`
      id, inicio, fim, status, obs,
      cliente:clientes(id,nome,telefone),
      profissional:profissionais(id,nome),
      servico:servicos(id,nome,duracao_min,preco)
    `)
    .gte("inicio", start.toISOString())
    .lte("inicio", end.toISOString())
    .order("inicio", { ascending:true });

  if(filterProf.value) q = q.eq("profissional_id", filterProf.value);
  if(filterStatus.value) q = q.eq("status", filterStatus.value);

  const { data, error } = await q;
  if(error) throw error;
  cache.agenda = data || [];
  renderAgenda();
}

async function loadCaixa(){
  const de = cxDe.value || toISODate(new Date());
  const ate = cxAte.value || toISODate(new Date());

  const start = new Date(`${de}T00:00:00`);
  const end = new Date(`${ate}T23:59:59`);

  const { data, error } = await supabaseClient
    .from("pagamentos")
    .select(`
      id, forma, valor, criado_em,
      comanda:comandas(
        id,
        agendamento:agendamentos(
          id,
          inicio,
          cliente:clientes(nome),
          servico:servicos(nome)
        )
      )
    `)
    .gte("criado_em", start.toISOString())
    .lte("criado_em", end.toISOString())
    .order("criado_em", { ascending:false });

  if(error) throw error;
  cache.caixa = data || [];
  renderCaixa();
}

// ===== Renderers =====
function fillClientesSelect(){
  const opts = ['<option value="">Selecione...</option>']
    .concat(cache.clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`));
  agCliente.innerHTML = opts.join("");
}
function fillServicosSelect(){
  const opts = ['<option value="">(Sem serviço)</option>']
    .concat(cache.servicos.filter(s=>s.ativo).map(s => {
      const label = `${s.nome} • ${s.duracao_min}min • ${fmtBRL(s.preco)}`;
      return `<option value="${s.id}" data-dur="${s.duracao_min}" data-preco="${s.preco}">${escapeHtml(label)}</option>`;
    }));
  agServico.innerHTML = opts.join("");
}
function fillProfSelects(){
  const profs = cache.profissionais.filter(p=>p.ativo);
  const base = ['<option value="">Todos</option>']
    .concat(profs.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`));
  filterProf.innerHTML = base.join("");

  const optsAg = ['<option value="">Selecione...</option>']
    .concat(profs.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`));
  agProf.innerHTML = optsAg.join("");
}

function renderAgenda(){
  tblAgendaBody.innerHTML = "";

  if(cache.agenda.length === 0){
    tblAgendaBody.innerHTML = `<tr><td colspan="6" class="muted">Sem agendamentos.</td></tr>`;
    return;
  }

  for(const a of cache.agenda){
    const cliente = a.cliente?.nome || "(sem cliente)";
    const prof = a.profissional?.nome || "-";
    const serv = a.servico?.nome || "(sem serviço)";
    const hora = `${isoToHHMM(a.inicio)}–${isoToHHMM(a.fim)}`;

    const badge = statusBadge(a.status);

    const canFinalize = (a.status === "marcado" || a.status === "confirmado");
    const actions = [];
    actions.push(`<button class="btn ghost" data-act="edit" data-id="${a.id}">Editar</button>`);
    if(a.status !== "cancelado") actions.push(`<button class="btn danger" data-act="cancel" data-id="${a.id}">Cancelar</button>`);
    if(canFinalize) actions.push(`<button class="btn" data-act="finalize" data-id="${a.id}">Finalizar</button>`);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${hora}</td>
      <td>${escapeHtml(cliente)}</td>
      <td>${escapeHtml(prof)}</td>
      <td>${escapeHtml(serv)}</td>
      <td>${badge}</td>
      <td class="right">
        <div class="actionsCell">${actions.join("")}</div>
      </td>
    `;
    tblAgendaBody.appendChild(tr);
  }
}

function renderClientes(){
  const q = (clSearch.value || "").trim().toLowerCase();
  const list = !q ? cache.clientes : cache.clientes.filter(c => (c.nome||"").toLowerCase().includes(q) || (c.telefone||"").toLowerCase().includes(q));

  tblClientesBody.innerHTML = "";
  if(list.length === 0){
    tblClientesBody.innerHTML = `<tr><td colspan="4" class="muted">Nenhum cliente.</td></tr>`;
    return;
  }

  for(const c of list){
    const niver = c.aniversario ? brFromISODate(c.aniversario) : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.telefone || "-")}</td>
      <td>${escapeHtml(niver)}</td>
      <td class="right">
        <div class="actionsCell">
          <button class="btn ghost" data-act="editCliente" data-id="${c.id}">Editar</button>
          <button class="btn danger" data-act="delCliente" data-id="${c.id}">Deletar</button>
        </div>
      </td>
    `;
    tblClientesBody.appendChild(tr);
  }
}

function renderServicos(){
  tblServicosBody.innerHTML = "";
  if(cache.servicos.length === 0){
    tblServicosBody.innerHTML = `<tr><td colspan="4" class="muted">Nenhum serviço.</td></tr>`;
    return;
  }
  for(const s of cache.servicos){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.nome)}</td>
      <td>${escapeHtml(String(s.duracao_min))} min</td>
      <td>${fmtBRL(s.preco)}</td>
      <td class="right">
        <div class="actionsCell">
          <button class="btn ghost" data-act="toggleServ" data-id="${s.id}">${s.ativo ? "Desativar" : "Ativar"}</button>
          <button class="btn danger" data-act="delServ" data-id="${s.id}">Deletar</button>
        </div>
      </td>
    `;
    tblServicosBody.appendChild(tr);
  }
}

function renderProfissionais(){
  tblProfBody.innerHTML = "";
  if(cache.profissionais.length === 0){
    tblProfBody.innerHTML = `<tr><td colspan="3" class="muted">Nenhum profissional.</td></tr>`;
    return;
  }
  for(const p of cache.profissionais){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.nome)}</td>
      <td>${p.ativo ? `<span class="badge ok">Ativo</span>` : `<span class="badge bad">Inativo</span>`}</td>
      <td class="right">
        <div class="actionsCell">
          <button class="btn ghost" data-act="toggleProf" data-id="${p.id}">${p.ativo ? "Desativar" : "Ativar"}</button>
          <button class="btn danger" data-act="delProf" data-id="${p.id}">Deletar</button>
        </div>
      </td>
    `;
    tblProfBody.appendChild(tr);
  }
}

function renderCaixa(){
  tblCaixaBody.innerHTML = "";
  let total = 0;

  if(cache.caixa.length === 0){
    tblCaixaBody.innerHTML = `<tr><td colspan="5" class="muted">Sem pagamentos no período.</td></tr>`;
    kpiTotal.textContent = fmtBRL(0);
    return;
  }

  for(const p of cache.caixa){
    total += Number(p.valor || 0);

    const criado = p.criado_em ? new Date(p.criado_em) : null;
    const dataStr = criado ? `${pad(criado.getDate())}/${pad(criado.getMonth()+1)}/${criado.getFullYear()} ${pad(criado.getHours())}:${pad(criado.getMinutes())}` : "-";

    const cliente = p.comanda?.agendamento?.cliente?.nome || "-";
    const serv = p.comanda?.agendamento?.servico?.nome || "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(dataStr)}</td>
      <td>${escapeHtml(cliente)}</td>
      <td>${escapeHtml(serv)}</td>
      <td>${escapeHtml(String(p.forma || "-"))}</td>
      <td class="right">${fmtBRL(p.valor)}</td>
    `;
    tblCaixaBody.appendChild(tr);
  }

  kpiTotal.textContent = fmtBRL(total);
}

// ===== Actions (CRUD) =====
async function addCliente(){
  setMsg(clMsg, "");
  const nome = (clNome.value||"").trim();
  if(!nome){ setMsg(clMsg,"Informe o nome."); return; }

  const payload = {
    nome,
    telefone: (clTel.value||"").trim() || null,
    aniversario: clNiver.value || null,
    obs: (clObs.value||"").trim() || null,
  };

  const { error } = await supabaseClient.from("clientes").insert(payload);
  if(error){ setMsg(clMsg, error.message); return; }

  clNome.value = ""; clTel.value=""; clNiver.value=""; clObs.value="";
  setMsg(clMsg, "Cliente adicionado.");
  await loadClientes();
}

async function addServico(){
  setMsg(svMsg, "");
  const nome = (svNome.value||"").trim();
  const dur = Number(svDur.value||0);
  const preco = Number(svPreco.value||0);
  if(!nome){ setMsg(svMsg,"Informe o nome."); return; }
  if(!dur || dur < 5){ setMsg(svMsg,"Duração inválida."); return; }

  const { error } = await supabaseClient.from("servicos").insert({
    nome, duracao_min: dur, preco
  });
  if(error){ setMsg(svMsg, error.message); return; }

  svNome.value=""; svDur.value=30; svPreco.value=0;
  setMsg(svMsg, "Serviço adicionado.");
  await loadServicos();
}

async function addProf(){
  setMsg(pfMsg, "");
  const nome = (pfNome.value||"").trim();
  if(!nome){ setMsg(pfMsg,"Informe o nome."); return; }

  const { error } = await supabaseClient.from("profissionais").insert({ nome });
  if(error){ setMsg(pfMsg, error.message); return; }

  pfNome.value="";
  setMsg(pfMsg, "Profissional adicionado.");
  await loadProfissionais();
}

async function saveAgendamento(){
  setMsg(agMsg, "");

  const clienteId = agCliente.value || null;
  const profId = agProf.value;
  const servId = agServico.value || null;

  const inicioLocal = agInicio.value;
  const dur = Number(agDur.value||0);
  const status = agStatus.value || "marcado";
  const obs = (agObs.value||"").trim() || null;

  if(!profId){ setMsg(agMsg,"Selecione o profissional."); return; }
  if(!inicioLocal){ setMsg(agMsg,"Informe o início."); return; }
  if(!dur || dur < 5){ setMsg(agMsg,"Duração inválida."); return; }

  const inicioIso = localToISO(inicioLocal);
  const fimIso = new Date(new Date(inicioLocal).getTime() + dur*60000).toISOString();

  // Checagem de conflito (MVP): mesmo profissional, overlap, e status não cancelado
  const { data: conflicts, error: errConf } = await supabaseClient
    .from("agendamentos")
    .select("id")
    .eq("profissional_id", profId)
    .not("status", "eq", "cancelado")
    .lt("inicio", fimIso)
    .gt("fim", inicioIso)
    .limit(1);

  if(errConf){ setMsg(agMsg, errConf.message); return; }
  if(conflicts && conflicts.length > 0){
    setMsg(agMsg, "Conflito de horário: já existe agendamento para esse profissional nesse intervalo.");
    return;
  }

  const session = await getSession();
  const payload = {
    cliente_id: clienteId,
    profissional_id: profId,
    servico_id: servId,
    inicio: inicioIso,
    fim: fimIso,
    status,
    obs,
    created_by: session.user.id
  };

  const { error } = await supabaseClient.from("agendamentos").insert(payload);
  if(error){ setMsg(agMsg, error.message); return; }

  setMsg(agMsg, "Agendamento salvo.");
  agObs.value = "";
  await loadAgenda();
}

async function cancelAgendamento(id){
  if(!confirm("Cancelar esse agendamento?")) return;
  const { error } = await supabaseClient.from("agendamentos").update({ status:"cancelado" }).eq("id", id);
  if(error){ alert(error.message); return; }
  await loadAgenda();
}

async function editAgendamento(id){
  const item = cache.agenda.find(x => x.id === id);
  if(!item) return;

  // edição simples: status e obs
  const newStatus = prompt("Status (marcado, confirmado, cancelado, finalizado):", item.status);
  if(!newStatus) return;
  const newObs = prompt("Observação:", item.obs || "") ?? item.obs;

  const { error } = await supabaseClient
    .from("agendamentos")
    .update({ status: newStatus, obs: newObs })
    .eq("id", id);

  if(error){ alert(error.message); return; }
  await loadAgenda();
}

async function finalizarAgendamento(id){
  // cria comanda + item do serviço + pagamento e marca finalizado
  const a = cache.agenda.find(x => x.id === id);
  if(!a) return;

  const servNome = a.servico?.nome || "Serviço";
  const servPreco = Number(a.servico?.preco || 0);

  const forma = prompt("Forma de pagamento (pix, cartao, dinheiro, outros):", "pix") || "pix";
  const desconto = Number(prompt("Desconto (R$):", "0") || "0");
  const total = Math.max(0, servPreco - desconto);

  // 1) cria comanda
  const { data: comData, error: comErr } = await supabaseClient
    .from("comandas")
    .insert({
      agendamento_id: id,
      subtotal: servPreco,
      desconto: desconto,
      total: total,
      fechado_em: new Date().toISOString()
    })
    .select("id")
    .single();

  if(comErr){
    alert(comErr.message);
    return;
  }

  // 2) item
  const { error: itErr } = await supabaseClient
    .from("comanda_itens")
    .insert({
      comanda_id: comData.id,
      tipo: "servico",
      descricao: servNome,
      qtd: 1,
      valor_unit: servPreco,
      total: servPreco
    });
  if(itErr){ alert(itErr.message); return; }

  // 3) pagamento
  const { error: pgErr } = await supabaseClient
    .from("pagamentos")
    .insert({
      comanda_id: comData.id,
      forma: (forma || "pix").toLowerCase(),
      valor: total
    });
  if(pgErr){ alert(pgErr.message); return; }

  // 4) marca agendamento finalizado
  const { error: agErr } = await supabaseClient
    .from("agendamentos")
    .update({ status:"finalizado" })
    .eq("id", id);

  if(agErr){ alert(agErr.message); return; }

  alert(`Finalizado! Total: ${fmtBRL(total)}`);
  await loadAgenda();
}

// ===== Delete / toggle (admin) =====
async function delRow(table, id){
  if(!confirm("Deletar? (admin apenas)")) return;
  const { error } = await supabaseClient.from(table).delete().eq("id", id);
  if(error) alert(error.message);
}
async function toggleRow(table, id, field, current){
  const { error } = await supabaseClient.from(table).update({ [field]: !current }).eq("id", id);
  if(error) alert(error.message);
}

// ===== CSV Export =====
function exportAgendaCsv(){
  const day = agendaDay.value || toISODate(new Date());
  const header = ["dia","inicio","fim","cliente","telefone","profissional","servico","status","obs"];
  const rows = cache.agenda.map(a => ([
    day,
    isoToHHMM(a.inicio),
    isoToHHMM(a.fim),
    (a.cliente?.nome || ""),
    (a.cliente?.telefone || ""),
    (a.profissional?.nome || ""),
    (a.servico?.nome || ""),
    (a.status || ""),
    (a.obs || "")
  ]));
  const csv = [header, ...rows]
    .map(cols => cols.map(v => `"${String(v).replaceAll('"','""')}"`).join(";"))
    .join("\n");
  downloadText(`agenda_${day}.csv`, csv);
}

// ===== small utils =====
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function brFromISODate(isoDate){
  // yyyy-mm-dd
  if(!isoDate) return "";
  const [y,m,d] = String(isoDate).split("-");
  if(!y||!m||!d) return String(isoDate);
  return `${d}/${m}/${y}`;
}
function statusBadge(status){
  const map = {
    marcado: ["warn","Marcado"],
    confirmado: ["ok","Confirmado"],
    cancelado: ["bad","Cancelado"],
    finalizado: ["ok","Finalizado"],
  };
  const [cls, txt] = map[status] || ["","-"];
  return `<span class="badge ${cls}">${txt}</span>`;
}

// ===== Boot =====
async function boot(){
  loadTheme();

  const session = await getSession();
  if(!session){
    viewLogin.classList.remove("hidden");
    viewApp.classList.add("hidden");
    whoami.textContent = "";
    return;
  }

  try{
    me = await getMyProfile();
  }catch(e){
    console.error(e);
    // se profile não existir por algum motivo, tenta criar na mão
    await supabaseClient.from("profiles").upsert({ id: session.user.id, nome: session.user.email, role:"func" });
    me = await getMyProfile();
  }

  viewLogin.classList.add("hidden");
  viewApp.classList.remove("hidden");

  whoami.textContent = `${me?.nome || session.user.email} • ${me?.role || "func"}`;

  // defaults
  const today = toISODate(new Date());
  agendaDay.value = today;
  agInicio.value = nowLocalDatetime();
  cxDe.value = today;
  cxAte.value = today;

  // carrega dados base
  await Promise.all([loadClientes(), loadServicos(), loadProfissionais()]);
  await loadAgenda();
  openTab("agenda");
}

function wireEvents(){
  btnTheme.addEventListener("click", toggleTheme);
  btnLogout.addEventListener("click", doLogout);

  btnLogin.addEventListener("click", doLogin);
  btnForgot.addEventListener("click", doForgot);

  tabs.forEach(t => t.addEventListener("click", () => openTab(t.dataset.tab)));

  btnRefresh.addEventListener("click", async () => {
    await Promise.all([loadClientes(), loadServicos(), loadProfissionais()]);
    await loadAgenda();
  });

  btnExportCsv.addEventListener("click", exportAgendaCsv);

  // Agenda filters
  agendaDay.addEventListener("change", loadAgenda);
  filterProf.addEventListener("change", loadAgenda);
  filterStatus.addEventListener("change", loadAgenda);

  // Serviço -> auto duração
  agServico.addEventListener("change", () => {
    const opt = agServico.selectedOptions?.[0];
    const dur = opt?.getAttribute("data-dur");
    if(dur) agDur.value = String(dur);
  });

  btnAgendar.addEventListener("click", saveAgendamento);

  // tabela agenda actions (delegation)
  $("tblAgenda").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if(!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if(!id || !act) return;

    if(act === "cancel") return cancelAgendamento(id);
    if(act === "edit") return editAgendamento(id);
    if(act === "finalize") return finalizarAgendamento(id);
  });

  // Clientes
  btnAddCliente.addEventListener("click", addCliente);
  clSearch.addEventListener("input", renderClientes);

  $("tblClientes").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if(!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if(!id || !act) return;

    if(act === "delCliente"){
      await delRow("clientes", id);
      await loadClientes();
      return;
    }
    if(act === "editCliente"){
      const c = cache.clientes.find(x=>x.id===id);
      if(!c) return;
      const nome = prompt("Nome:", c.nome) ?? c.nome;
      const tel = prompt("Telefone:", c.telefone || "") ?? c.telefone;
      const { error } = await supabaseClient.from("clientes").update({ nome, telefone: tel }).eq("id", id);
      if(error) alert(error.message);
      await loadClientes();
      return;
    }
  });

  // Serviços
  btnAddServico.addEventListener("click", addServico);
  $("tblServicos").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if(!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if(!id || !act) return;

    const s = cache.servicos.find(x=>x.id===id);
    if(act === "toggleServ"){
      await toggleRow("servicos", id, "ativo", !!s?.ativo);
      await loadServicos();
      return;
    }
    if(act === "delServ"){
      await delRow("servicos", id);
      await loadServicos();
      return;
    }
  });

  // Profissionais
  btnAddProf.addEventListener("click", addProf);
  $("tblProf").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if(!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if(!id || !act) return;

    const p = cache.profissionais.find(x=>x.id===id);
    if(act === "toggleProf"){
      await toggleRow("profissionais", id, "ativo", !!p?.ativo);
      await loadProfissionais();
      return;
    }
    if(act === "delProf"){
      await delRow("profissionais", id);
      await loadProfissionais();
      return;
    }
  });

  // Caixa
  cxDe.addEventListener("change", loadCaixa);
  cxAte.addEventListener("change", loadCaixa);

  // Reagir a mudanças de sessão
  supabaseClient.auth.onAuthStateChange(() => boot());
}

// start
wireEvents();
boot();
