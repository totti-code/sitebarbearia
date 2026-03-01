// ===== Cole as mesmas credenciais do app.js =====
const SUPABASE_URL = "https://qdvywfdfalzgjjxigsfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7Ui7z4RjONohMUMFwXb7mg_P4BzzONL";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const servico = $("servico");
const prof = $("prof");
const dia = $("dia");
const hora = $("hora");
const msg = $("msg");

function pad(n){ return String(n).padStart(2,"0"); }
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function loadServicos(){
  const { data, error } = await sb
    .from("servicos")
    .select("id,nome,duracao_min,preco,ativo")
    .eq("ativo", true)
    .order("nome", { ascending:true });

  if(error) throw error;

  servico.innerHTML = ['<option value="">Selecione...</option>']
    .concat((data||[]).map(s => (
      `<option value="${s.id}" data-dur="${s.duracao_min}">
        ${escapeHtml(s.nome)} • ${s.duracao_min}min
      </option>`
    ))).join("");
}

async function loadProfissionais(){
  const { data, error } = await sb
    .from("profissionais")
    .select("id,nome,ativo")
    .eq("ativo", true)
    .order("nome", { ascending:true });

  if(error) throw error;

  prof.innerHTML = ['<option value="">Selecione...</option>']
    .concat((data||[]).map(p => (
      `<option value="${p.id}">${escapeHtml(p.nome)}</option>`
    ))).join("");
}

// gera horários em slots (ex: 09:00 a 18:00)
function generateSlots(start="09:00", end="18:00", stepMin=30){
  const out = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh*60 + sm;
  const endMin = eh*60 + em;
  while(cur + stepMin <= endMin){
    const h = Math.floor(cur/60), m = cur%60;
    out.push(`${pad(h)}:${pad(m)}`);
    cur += stepMin;
  }
  return out;
}

async function loadHorariosDisponiveis(){
  msg.textContent = "";
  const serviceOpt = servico.selectedOptions[0];
  const dur = Number(serviceOpt?.getAttribute("data-dur") || 30);

  if(!dia.value || !prof.value || !servico.value){
    hora.innerHTML = `<option value="">Selecione serviço, profissional e dia</option>`;
    return;
  }

  // horário base do salão (ajusta aqui)
  const slots = generateSlots("09:00","18:00",30);

  // buscar agendamentos existentes do dia (para bloquear conflito)
  const day = dia.value;
  const start = new Date(`${day}T00:00:00`).toISOString();
  const end = new Date(`${day}T23:59:59`).toISOString();

  const { data: ags, error } = await sb
    .from("agendamentos")
    .select("inicio,fim,status,profissional_id")
    .eq("profissional_id", prof.value)
    .not("status", "eq", "cancelado")
    .gte("inicio", start)
    .lte("inicio", end);

  if(error) {
    // se RLS bloquear leitura para anon, você pode remover essa checagem e só validar no painel
    // mas como a policy de agendamentos no seu MVP estava "authenticated", anon não consegue ler mesmo.
    // então vamos cair para modo simples:
    hora.innerHTML = slots.map(h => `<option value="${h}">${h}</option>`).join("");
    msg.textContent = "Horários carregados (confirmação final pelo salão).";
    return;
  }

  // monta lista bloqueada por overlap (se anon conseguir ler)
  const blocked = new Set();
  for(const s of slots){
    const inicioLocal = new Date(`${day}T${s}:00`);
    const fimLocal = new Date(inicioLocal.getTime() + dur*60000);

    const overlap = (ags||[]).some(a => {
      const ai = new Date(a.inicio), af = new Date(a.fim);
      return ai < fimLocal && af > inicioLocal;
    });
    if(overlap) blocked.add(s);
  }

  const options = slots
    .filter(h => !blocked.has(h))
    .map(h => `<option value="${h}">${h}</option>`)
    .join("");

  hora.innerHTML = options || `<option value="">Sem horários</option>`;
}

async function enviar(){
  msg.textContent = "";
  const nome = $("nome").value.trim();
  const tel = $("tel").value.trim();
  const obs = $("obs").value.trim() || null;

  if(!nome || !tel) { msg.textContent = "Preencha nome e telefone."; return; }
  if(!servico.value || !prof.value || !dia.value || !hora.value){
    msg.textContent = "Selecione serviço, profissional, dia e horário.";
    return;
  }

  const dur = Number(servico.selectedOptions[0]?.getAttribute("data-dur") || 30);
  const inicio = new Date(`${dia.value}T${hora.value}:00`);
  const fim = new Date(inicio.getTime() + dur*60000);

  const payload = {
    nome_cliente: nome,
    telefone: tel,
    servico_id: servico.value,
    profissional_id: prof.value,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    obs,
    status: "pendente"
  };

  const { error } = await sb.from("agendamentos_publicos").insert(payload);
  if(error){
    msg.textContent = error.message;
    return;
  }

  msg.textContent = "Solicitação enviada! O salão vai confirmar.";
  $("obs").value = "";
}

async function init(){
  dia.value = todayISO();
  await Promise.all([loadServicos(), loadProfissionais()]);
  await loadHorariosDisponiveis();

  servico.addEventListener("change", loadHorariosDisponiveis);
  prof.addEventListener("change", loadHorariosDisponiveis);
  dia.addEventListener("change", loadHorariosDisponiveis);
  $("btnEnviar").addEventListener("click", enviar);
}

init().catch(e => { console.error(e); msg.textContent = e.message; });
