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

function setMsg(text){
  msg.textContent = text || "";
}

// =========================
// Carregar serviços/profissionais (público)
// =========================
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

// =========================
// Horários DISPONÍVEIS (via RPC)
// =========================
async function loadHorariosDisponiveis(){
  setMsg("");

  if(!dia.value || !prof.value || !servico.value){
    hora.innerHTML = `<option value="">Selecione serviço, profissional e dia</option>`;
    return;
  }

  const dur = Number(servico.selectedOptions?.[0]?.getAttribute("data-dur") || 30);

  // RPC: get_available_slots
  const { data, error } = await sb.rpc("get_available_slots", {
    p_profissional_id: prof.value,
    p_dia: dia.value,                  // "YYYY-MM-DD"
    p_duracao_min: dur,
    p_abre: "09:00:00",
    p_fecha: "18:00:00",
    p_step_min: 30
  });

  if(error){
    console.error(error);
    hora.innerHTML = `<option value="">Erro ao carregar horários</option>`;
    setMsg(error.message || "Erro ao carregar horários.");
    return;
  }

  const slots = (data || []).map(r => String(r.slot).slice(0,5)); // HH:MM

  hora.innerHTML = slots.length
    ? slots.map(h => `<option value="${h}">${h}</option>`).join("")
    : `<option value="">Sem horários disponíveis</option>`;
}

// =========================
// Agendar DIRETO (via RPC)
// =========================
async function enviar(){
  setMsg("");

  const nome = $("nome").value.trim();
  const tel  = $("tel").value.trim();
  const obs  = $("obs").value.trim() || null;

  if(!nome || !tel){
    setMsg("Preencha nome e telefone.");
    return;
  }
  if(!servico.value || !prof.value || !dia.value || !hora.value){
    setMsg("Selecione serviço, profissional, dia e horário.");
    return;
  }

  const dur = Number(servico.selectedOptions?.[0]?.getAttribute("data-dur") || 30);

  // RPC: book_appointment_public
  const { data, error } = await sb.rpc("book_appointment_public", {
    p_nome_cliente: nome,
    p_telefone: tel,
    p_profissional_id: prof.value,
    p_servico_id: servico.value,
    p_dia: dia.value,
    p_hora: hora.value + ":00",     // HH:MM:SS
    p_duracao_min: dur,
    p_obs: obs
  });

  if(error){
    console.error(error);
    setMsg(error.message || "Não foi possível agendar.");
    // atualiza lista porque pode ter mudado (alguém pegou antes)
    await loadHorariosDisponiveis();
    return;
  }

  // data geralmente vem como UUID do agendamento criado
  setMsg("Agendamento confirmado! ✅");
  $("obs").value = "";

  // Recarrega horários para "sumir" o horário recém-agendado
  await loadHorariosDisponiveis();
}

// =========================
// Init
// =========================
async function init(){
  dia.value = todayISO();

  await Promise.all([loadServicos(), loadProfissionais()]);
  await loadHorariosDisponiveis();

  servico.addEventListener("change", loadHorariosDisponiveis);
  prof.addEventListener("change", loadHorariosDisponiveis);
  dia.addEventListener("change", loadHorariosDisponiveis);
  $("btnEnviar").addEventListener("click", enviar);
}

init().catch(e => {
  console.error(e);
  setMsg(e.message || "Erro ao iniciar.");
});
