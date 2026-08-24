import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE (INTEGRADA DIRECTAMENTE) ---
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
(window as any).db = db;

// --- ESTILOS COMPARTIDOS DEL SISTEMA DE DISEÑO ---
const STYLES = {
  glassCard: {
    background: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.98)',
    outline: '0.5px solid rgba(0, 32, 96, 0.06)',
    boxShadow: '0 0 0 0.5px rgba(0,32,96,.06), 0 2px 8px rgba(0,32,96,.06), 0 8px 24px rgba(0,32,96,.08), inset 0 1px 1px #ffffff',
    padding: '1.4rem',
    marginBottom: '1rem',
  },
  metricCard: {
    background: 'rgba(0, 32, 96, 0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 4px 12px rgba(0,32,96,.18), 0 12px 30px rgba(0,32,96,.15), inset 0 1px 1px rgba(255,255,255,.18)',
    padding: '16px',
    color: '#ffffff',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid rgba(0, 32, 96, 0.12)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#0D1A2E',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }
};

// --- CATÁLOGO DE MÁQUINAS Y ÁREAS ---
interface Maquina {
  id: string;
  nombre: string;
  tipo: string;
  moduloProceso: boolean;
  modulo5S: boolean;
}

const CATALOGO: Maquina[] = [
  // Flexografía
  { id: 'FL1', nombre: 'FL1 (Flexográfica 1)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'FL2', nombre: 'FL2 (Flexográfica 2)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'FL3', nombre: 'FL3 (Flexográfica 3)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'FL4', nombre: 'FL4 (Flexográfica 4)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  // Rotograbado
  { id: 'RT5', nombre: 'RT5 (Rotograbado 5)', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'RT6', nombre: 'RT6 (Rotograbado 6)', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'RT7', nombre: 'RT7 (Rotograbado 7)', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  // Laminado, Depuración Impresión y Digital
  { id: 'LAM1', nombre: 'LAM1 (Laminadora)', tipo: 'Laminado', moduloProceso: true, modulo5S: true },
  { id: 'DEP1', nombre: 'DEP1 (Depuradora Impresión)', tipo: 'Depuración', moduloProceso: true, modulo5S: true },
  { id: 'ZEI1', nombre: 'ZEI1 (Impresora Digital)', tipo: 'Digital', moduloProceso: true, modulo5S: true },
  { id: 'OME1', nombre: 'OME1 (Suajadora)', tipo: 'Suajado', moduloProceso: true, modulo5S: true },
  // Refilado
  { id: 'REF1', nombre: 'REF1 (Refiladora 1)', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'REF2', nombre: 'REF2 (Refiladora 2)', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'REF3', nombre: 'REF3 (Refiladora 3)', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  // Pegadoras
  { id: 'PEG1', nombre: 'PEG1 (Pegadora 1)', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  { id: 'PEG2', nombre: 'PEG2 (Pegadora 2)', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  // Revisadoras
  { id: 'REV1', nombre: 'REV1 (Revisadora 1)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV2', nombre: 'REV2 (Revisadora 2)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV3', nombre: 'REV3 (Revisadora 3)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV4', nombre: 'REV4 (Revisadora 4)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV6', nombre: 'REV6 (Revisadora 6)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV8', nombre: 'REV8 (Revisadora 8)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  // Depuración Etiquetas y Corte
  { id: 'DEP2', nombre: 'DEP2 (Depuración Etiquetas)', tipo: 'Depuración', moduloProceso: true, modulo5S: true },
  { id: 'COR1', nombre: 'COR1 (Cortadora 1)', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'COR2', nombre: 'COR2 (Cortadora 2)', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'COR3', nombre: 'COR3 (Cortadora 3)', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  // Áreas Auxiliares y Soporte
  { id: 'area-tintas', nombre: 'Área de Tintas', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-banos', nombre: 'Baños de Producción', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mp', nombre: 'Almacén Materia Prima', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-pt', nombre: 'Almacén Producto Terminado', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mant', nombre: 'Taller Mantenimiento', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-prep', nombre: 'Área Pre-prensa', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-cal', nombre: 'Laboratorio Calidad', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true }
];

const FAMILIAS_PROCESO = Array.from(new Set(CATALOGO.filter((m) => m.moduloProceso).map((m) => m.tipo)));
const FAMILIAS_5S = Array.from(new Set(CATALOGO.filter((m) => m.modulo5S).map((m) => m.tipo)));

interface ItemChecklist {
  id: number;
  seccion: string;
  queObservar: string;
  comoVerifica: string;
}

const CHECKLIST_BASE_PEGADO: ItemChecklist[] = [
  { id: 1, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'El solvente montado corresponde al sustrato del pedido', comoVerifica: 'Comparar etiqueta del bote vs. sustrato de la ficha; lote anotado en reporte' },
  { id: 2, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'El operador realizó y registró la prueba de aporte', comoVerifica: 'Pedir el cálculo: mL ÷ velocidad = 0.015' },
  { id: 3, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'La aguja fue calibrada en el arranque / tras romperse el material', comoVerifica: 'Preguntar cuándo la calibró; chorro recto y continuo' },
  { id: 4, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'Presión de aire del tanque de adhesivo en rango', comoVerifica: 'Manómetro entre 0.51 y 0.65 MPa' },
  { id: 5, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'Velocidades de activar/desactivar solvente configuradas', comoVerifica: 'Activar = trabajo −100 · Desactivar = programada −50' },
  { id: 6, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Presión del NIP dentro de rango', comoVerifica: 'Manómetro 35–40 PSI (mín. 28 solo sin deslizamiento)' },
  { id: 7, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Aguja en zona cristal de 3 mm, ~1 mm de altura, 45°', comoVerifica: 'Observación visual de la aguja en la unidad' },
  { id: 8, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Grosor de adhesivo dentro de parámetro', comoVerifica: 'Medir muestra: 2.0–2.8 mm' },
  { id: 9, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Ancho plano y doblez coinciden con ficha gráfica', comoVerifica: 'Medir con regla flexible vs. ficha' },
  { id: 10, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Rango de alarma configurado y 3 alarmas en ON', comoVerifica: 'Pantalla: ±0.3 mm · Falta Cinta / Fluorescente / Defecto Ancho' },
  { id: 11, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Interruptores encendidos (Medidor Ancho Plano, Luz UV, Sistema Etiqueta)', comoVerifica: 'Revisar panel central' },
  { id: 12, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Banderas rojas colocadas en arranque y fin de pedido', comoVerifica: 'Inspección de la bobina / rebobinador' },
  { id: 13, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Hoja viajera llenada con NCR y etiquetas de rastreo por rollo', comoVerifica: 'Revisar hoja viajera del máster en proceso' },
  { id: 14, seccion: 'D · VALIDACIÓN Y LIBERACIÓN', queObservar: 'Firma de validación de preparación de máquina del supervisor', comoVerifica: 'Revisar F1-PR-PA-03 firmado' },
  { id: 15, seccion: 'D · VALIDACIÓN Y LIBERACIÓN', queObservar: 'Arranque autorizado por Calidad (no se arrancó sin autorización)', comoVerifica: 'Confirmar liberación de calidad antes del arranque' },
  { id: 16, seccion: 'D · VALIDACIÓN Y LIBERACIÓN', queObservar: 'Reporte de producción sin espacios en blanco ni tachaduras; ancho plano y solvente registrados hora por hora', comoVerifica: 'Revisar F1-PR-PA-03' }
];

const CHECKLIST_OFICIAL_5S: ItemChecklist[] = [
  { id: 1, seccion: '1. ORDEN Y 5S', queObservar: 'Todas las herramientas y utensilios se encuentran y tienen lugar asignado', comoVerifica: 'Revisión visual de tableros, mesas y gavetas' },
  { id: 2, seccion: '1. ORDEN Y 5S', queObservar: 'Todos materiales, rollos, tarimas o contenedores se encuentran en su ubicación definida', comoVerifica: 'Verificar delimitaciones en piso y estantes' },
  { id: 3, seccion: '1. ORDEN Y 5S', queObservar: 'Pasillos, accesos y zonas de operación se encuentran despejados', comoVerifica: 'Inspección de líneas peatonales y áreas de maniobra' },
  { id: 4, seccion: '1. ORDEN Y 5S', queObservar: 'El área de trabajo se encuentra ordenada y libre de objetos innecesarios', comoVerifica: 'Revisión de superficies de apoyo y periferia' },
  { id: 5, seccion: '2. LIMPIEZA', queObservar: 'El área y la máquina se encuentran limpias', comoVerifica: 'Inspección de estructura, paneles y piso general' },
  { id: 6, seccion: '2. LIMPIEZA', queObservar: 'Sin derrames de tinta, solvente, aceite, agua u otros productos', comoVerifica: 'Revisar charolas, piso y conexiones de fluidos' },
  { id: 7, seccion: '2. LIMPIEZA', queObservar: 'Sin acumulación de papel, película, tinta, adhesivo o residuos alrededor de la máquina', comoVerifica: 'Inspección de desbobinador, rebobinador y piso' },
  { id: 8, seccion: '2. LIMPIEZA', queObservar: 'Los residuos y merma se encuentran correctamente segregados', comoVerifica: 'Verificar botes identificados y bolsas correspondientes' },
  { id: 9, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'La máquina esta sin daños físicos visibles que puedan afectar su operación', comoVerifica: 'Inspección de rodillos, guías y estructura' },
  { id: 10, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Sin reparaciones temporales, improvisaciones o soluciones provisionales', comoVerifica: 'Verificar sujeciones, ensambles y componentes' },
  { id: 11, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Sin fugas de aceite, aire, agua, tinta o solvente', comoVerifica: 'Revisión de manómetros, mangueras y cilindros' },
  { id: 12, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Sin cables, mangueras o conexiones dañadas, expuestas o improvisadas', comoVerifica: 'Inspección del cableado eléctrico y neumático' },
  { id: 13, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Guardas, cubiertas y protecciones de seguridad se encuentran instaladas y en buen estado', comoVerifica: 'Verificación física de guardas de protección' },
  { id: 14, seccion: '4. SEGURIDAD', queObservar: 'El paro de emergencia se encuentra accesible y sin obstrucciones', comoVerifica: 'Comprobar acceso libre inmediato al botón de paro' },
  { id: 15, seccion: '4. SEGURIDAD', queObservar: 'Extintores, rutas de evacuación y equipos de emergencia se encuentran despejados', comoVerifica: 'Inspección visual del área circundante' },
  { id: 16, seccion: '4. SEGURIDAD', queObservar: 'Sin condiciones que representen riesgo inmediato de atrapamiento, corte, golpe, incendio o derrame', comoVerifica: 'Evaluación general de riesgos en la estación' },
  { id: 17, seccion: '5. INFRAESTRUCTURA', queObservar: 'Sin presencia de goteras en maquina o periferia', comoVerifica: 'Inspección visual de techos e iluminación' },
  { id: 18, seccion: '5. INFRAESTRUCTURA', queObservar: 'Piso en condiciones de operación', comoVerifica: 'Verificar piso sin grietas graves ni desniveles riesgosos' },
  { id: 19, seccion: '5. INFRAESTRUCTURA', queObservar: 'Anaqueles y estantes disponibles para la operación', comoVerifica: 'Revisar orden y capacidad en estantería' },
  { id: 20, seccion: '5. INFRAESTRUCTURA', queObservar: 'Casilleros disponibles para articulos personales', comoVerifica: 'Inspección de gavetas asignadas al personal' }
];

type EstadoCumplimiento = 'PENDIENTE' | 'TERMINADO' | 'PENDIENTE_ATRASADO';

interface Hallazgo {
  id: string;
  puntoId?: number;
  esExtra?: boolean;
  hallazgo: string;
  accion: string;
  responsable: string;
  fechaCierre: string;
  estadoSeguimiento?: EstadoCumplimiento;
}

export const App: React.FC = () => {
  const [vista, setVista] = useState<'LAUNCHER' | 'MODULO_PROCESO' | 'MODULO_5S' | 'EVALUACION' | 'HISTORIAL' | 'EDITOR_PLANTILLAS'>('LAUNCHER');
  const [tipoAuditoriaActiva, setTipoAuditoriaActiva] = useState<'PROCESO' | '5S'>('PROCESO');
  const [subVistaHistorial, setSubVistaHistorial] = useState<'AUDITORIAS' | 'GANTT'>('AUDITORIAS');
  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState<Maquina | null>(null);

  // Selectores dependientes
  const [filtroProcesoFamilia, setFiltroProcesoFamilia] = useState('');
  const [filtroProcesoMaquinaId, setFiltroProcesoMaquinaId] = useState('');
  const [filtro5SFamilia, setFiltro5SFamilia] = useState('');
  const [filtro5SMaquinaId, setFiltro5SMaquinaId] = useState('');

  // Plantillas dinámicas
  const [plantillasProceso, setPlantillasProceso] = useState<Record<string, ItemChecklist[]>>({
    Pegado: CHECKLIST_BASE_PEGADO
  });
  const [plantillas5S, setPlantillas5S] = useState<Record<string, ItemChecklist[]>>({});

  // Editor de plantillas
  const [moduloEditor, setModuloEditor] = useState<'PROCESO' | '5S'>('5S');
  const [tipoSeleccionadoEditor, setTipoSeleccionadoEditor] = useState<string>('Flexografía');
  const [checklistEnEdicion, setChecklistEnEdicion] = useState<ItemChecklist[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nuevaSeccion, setNuevaSeccion] = useState('');
  const [nuevoQueObservar, setNuevoQueObservar] = useState('');
  const [nuevoComoVerifica, setNuevoComoVerifica] = useState('');
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  // Formulario Evaluación con Nóminas añadidas
  const [ordenTrabajo, setOrdenTrabajo] = useState('');
  const [auditor, setAuditor] = useState('');
  const [nominaAuditado, setNominaAuditado] = useState('');
  const [nominaSupervisor, setNominaSupervisor] = useState('');
  const [turno, setTurno] = useState('Matutino (6:00–14:00)');
  const [respuestas, setRespuestas] = useState<Record<number, 'SI' | 'NO' | null>>({});
  const [hallazgos, setHallazgos] = useState<Record<string, Hallazgo>>({});
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);

  // Filtros Gantt
  const [filtroOrigenGantt, setFiltroOrigenGantt] = useState('');
  const [filtroMaquinaGantt, setFiltroMaquinaGantt] = useState('');
  const [filtroMesGantt, setFiltroMesGantt] = useState('');
  const [filtroDiaGantt, setFiltroDiaGantt] = useState('');
  const [filtroCumplimientoGantt, setFiltroCumplimientoGantt] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubAuditorias = onSnapshot(collection(db, 'evaluaciones_proceso'), (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      docs.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setHistorial(docs);
    }, (error) => {
      console.error('Error al escuchar Firestore:', error);
    });

    const unsubPlantillasProceso = onSnapshot(collection(db, 'plantillas_checklists'), (snapshot) => {
      const dataP: Record<string, ItemChecklist[]> = { Pegado: CHECKLIST_BASE_PEGADO };
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.items && Array.isArray(data.items)) dataP[d.id] = data.items;
      });
      setPlantillasProceso(dataP);
    });

    const unsubPlantillas5S = onSnapshot(collection(db, 'plantillas_5s'), (snapshot) => {
      const data5: Record<string, ItemChecklist[]> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.items && Array.isArray(data.items)) data5[d.id] = data.items;
      });
      setPlantillas5S(data5);
    });

    return () => {
      unsubAuditorias();
      unsubPlantillasProceso();
      unsubPlantillas5S();
    };
  }, []);

  useEffect(() => {
    const fuente = moduloEditor === 'PROCESO' ? plantillasProceso : plantillas5S;
    const baseDefault = moduloEditor === 'PROCESO'
      ? (tipoSeleccionadoEditor === 'Pegado' ? CHECKLIST_BASE_PEGADO : [])
      : CHECKLIST_OFICIAL_5S;
    const items = fuente[tipoSeleccionadoEditor] || baseDefault;
    setChecklistEnEdicion(items);
    cancelarEdicionPregunta();
  }, [tipoSeleccionadoEditor, moduloEditor, plantillasProceso, plantillas5S, vista]);

  const itemsChecklistActivo = maquinaSeleccionada
    ? (tipoAuditoriaActiva === 'PROCESO'
        ? (plantillasProceso[maquinaSeleccionada.tipo] || (maquinaSeleccionada.tipo === 'Pegado' ? CHECKLIST_BASE_PEGADO : []))
        : (plantillas5S[maquinaSeleccionada.tipo] || CHECKLIST_OFICIAL_5S))
    : [];

  const handleRespuesta = (puntoId: number, valor: 'SI' | 'NO') => {
    setRespuestas((prev) => ({ ...prev, [puntoId]: valor }));
    const key = `punto_${puntoId}`;

    if (valor === 'NO' && !hallazgos[key]) {
      const item = itemsChecklistActivo.find((i) => i.id === puntoId);
      setHallazgos((prev) => ({
        ...prev,
        [key]: {
          id: key,
          puntoId,
          esExtra: false,
          hallazgo: `Desviación en: ${item?.queObservar || ''}`,
          accion: '',
          responsable: '',
          fechaCierre: todayStr,
          estadoSeguimiento: 'PENDIENTE'
        }
      }));
    } else if (valor === 'SI' && hallazgos[key]) {
      setHallazgos((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleAddHallazgoExtra = () => {
    const extraId = `extra_${Date.now()}`;
    setHallazgos((prev) => ({
      ...prev,
      [extraId]: {
        id: extraId,
        esExtra: true,
        hallazgo: '',
        accion: '',
        responsable: '',
        fechaCierre: todayStr,
        estadoSeguimiento: 'PENDIENTE'
      }
    }));
  };

  const handleRemoveHallazgoExtra = (key: string) => {
    setHallazgos((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleHallazgoChange = (key: string, campo: keyof Hallazgo, valor: string) => {
    setHallazgos((prev) => ({
      ...prev,
      [key]: { ...prev[key], [campo]: valor }
    }));
  };

  const totalRespondidos = Object.values(respuestas).filter((v) => v !== null).length;
  const totalSi = Object.values(respuestas).filter((v) => v === 'SI').length;
  const totalNo = Object.values(respuestas).filter((v) => v === 'NO').length;
  const listaHallazgos = Object.values(hallazgos);

  const cumplimiento = itemsChecklistActivo.length > 0
    ? totalRespondidos > 0 ? Math.round((totalSi / itemsChecklistActivo.length) * 100) : 0
    : listaHallazgos.length === 0 ? 100 : 80;

  const handleGuardarEvaluacion = async () => {
    if (!auditor.trim()) {
      alert('Por favor ingrese el Nombre del Auditor.');
      return;
    }
    if (tipoAuditoriaActiva === 'PROCESO' && !ordenTrabajo.trim()) {
      alert('Por favor ingrese la Orden de Trabajo (OP).');
      return;
    }

    if (itemsChecklistActivo.length > 0 && totalRespondidos < itemsChecklistActivo.length) {
      alert(`Faltan responder ${itemsChecklistActivo.length - totalRespondidos} puntos del checklist.`);
      return;
    }

    setGuardando(true);
    try {
      await addDoc(collection(db, 'evaluaciones_proceso'), {
        tipoAuditoria: tipoAuditoriaActiva,
        maquinaId: maquinaSeleccionada?.id,
        maquinaNombre: maquinaSeleccionada?.nombre,
        tipoMaquina: maquinaSeleccionada?.tipo,
        ordenTrabajo: ordenTrabajo.trim() || 'N/A 5S',
        auditor: auditor.trim(),
        nominaAuditado: nominaAuditado.trim(),
        nominaSupervisor: nominaSupervisor.trim(),
        turno,
        cumplimiento,
        totalSi: itemsChecklistActivo.length > 0 ? totalSi : (listaHallazgos.length === 0 ? 1 : 0),
        totalNo: itemsChecklistActivo.length > 0 ? totalNo : listaHallazgos.length,
        fechaAuditoria: todayStr,
        respuestas: itemsChecklistActivo.length > 0 ? respuestas : {},
        hallazgos: listaHallazgos,
        estadoFinal: (itemsChecklistActivo.length > 0 ? totalNo === 0 : listaHallazgos.length === 0) ? 'APROBADO' : 'CON_HALLAZGOS',
        createdAt: serverTimestamp()
      });

      alert('✅ Auditoría guardada y sincronizada correctamente.');
      setRespuestas({});
      setHallazgos({});
      setOrdenTrabajo('');
      setAuditor('');
      setNominaAuditado('');
      setNominaSupervisor('');
      setVista('HISTORIAL');
      setSubVistaHistorial('AUDITORIAS');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar en Firebase.');
    } finally {
      setGuardando(false);
    }
  };

  // --- EDITOR DE PLANTILLAS ---
  const handleGuardarOEditarPregunta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoQueObservar.trim() || !nuevoComoVerifica.trim()) {
      alert('Completa la descripción y la forma de verificación.');
      return;
    }

    if (editandoId !== null) {
      setChecklistEnEdicion((prev) =>
        prev.map((item) =>
          item.id === editandoId
            ? {
                ...item,
                seccion: nuevaSeccion.trim() || item.seccion,
                queObservar: nuevoQueObservar.trim(),
                comoVerifica: nuevoComoVerifica.trim()
              }
            : item
        )
      );
      cancelarEdicionPregunta();
    } else {
      const nuevoId = checklistEnEdicion.length > 0
        ? Math.max(...checklistEnEdicion.map((item) => item.id)) + 1
        : 1;

      const nuevoItem: ItemChecklist = {
        id: nuevoId,
        seccion: nuevaSeccion.trim() || (moduloEditor === '5S' ? '1. ORDEN Y 5S' : 'GENERAL · PARÁMETROS OPERATIVOS'),
        queObservar: nuevoQueObservar.trim(),
        comoVerifica: nuevoComoVerifica.trim()
      };

      setChecklistEnEdicion((prev) => [...prev, nuevoItem]);
      setNuevoQueObservar('');
      setNuevoComoVerifica('');
    }
  };

  const iniciarEdicionPregunta = (item: ItemChecklist) => {
    setEditandoId(item.id);
    setNuevaSeccion(item.seccion);
    setNuevoQueObservar(item.queObservar);
    setNuevoComoVerifica(item.comoVerifica);
  };

  const cancelarEdicionPregunta = () => {
    setEditandoId(null);
    setNuevaSeccion('');
    setNuevoQueObservar('');
    setNuevoComoVerifica('');
  };

  const handleEliminarPregunta = (id: number) => {
    if (confirm('¿Deseas eliminar este punto del checklist?')) {
      setChecklistEnEdicion((prev) => prev.filter((item) => item.id !== id));
      if (editandoId === id) cancelarEdicionPregunta();
    }
  };

  const handleGuardarPlantillaEnFirebase = async () => {
    setGuardandoPlantilla(true);
    try {
      const coleccionTarget = moduloEditor === 'PROCESO' ? 'plantillas_checklists' : 'plantillas_5s';
      const docRef = doc(db, coleccionTarget, tipoSeleccionadoEditor);
      await setDoc(docRef, {
        tipo: tipoSeleccionadoEditor,
        modulo: moduloEditor,
        items: checklistEnEdicion,
        actualizadoEn: serverTimestamp()
      });

      alert(`✅ Plantilla de ${moduloEditor} para "${tipoSeleccionadoEditor}" guardada.`);
    } catch (error) {
      console.error('Error al guardar plantilla:', error);
      alert('Error al guardar en Firebase.');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const handleToggleEstadoHallazgo = async (docId: string, hallazgoIdx: number, estadoActual?: EstadoCumplimiento) => {
    try {
      let nuevoEstado: EstadoCumplimiento = 'PENDIENTE';
      if (estadoActual === 'PENDIENTE' || !estadoActual) nuevoEstado = 'TERMINADO';
      else if (estadoActual === 'TERMINADO') nuevoEstado = 'PENDIENTE_ATRASADO';
      else if (estadoActual === 'PENDIENTE_ATRASADO') nuevoEstado = 'PENDIENTE';

      const docEncontrado = historial.find((h) => h.id === docId);
      if (docEncontrado && docEncontrado.hallazgos) {
        const nuevosHallazgos = [...docEncontrado.hallazgos];
        nuevosHallazgos[hallazgoIdx] = {
          ...nuevosHallazgos[hallazgoIdx],
          estadoSeguimiento: nuevoEstado
        };
        const docRef = doc(db, 'evaluaciones_proceso', docId);
        await updateDoc(docRef, { hallazgos: nuevosHallazgos });
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  };

  const hallazgosFiltradosGantt = historial.flatMap((auditoria) => {
    const tipoAuditoriaDoc = auditoria.tipoAuditoria || 'PROCESO';

    if (filtroOrigenGantt && tipoAuditoriaDoc !== filtroOrigenGantt) return [];
    if (filtroMaquinaGantt && auditoria.maquinaNombre !== filtroMaquinaGantt) return [];

    if (!auditoria.hallazgos || !Array.isArray(auditoria.hallazgos)) return [];

    return auditoria.hallazgos
      .map((h: Hallazgo, idx: number) => {
        const fAuditoria = auditoria.fechaAuditoria || todayStr;
        const fFin = h.fechaCierre || todayStr;
        let estatus: EstadoCumplimiento = h.estadoSeguimiento || 'PENDIENTE';

        // Regla automática de atraso
        if (estatus !== 'TERMINADO' && todayStr > fFin) {
          estatus = 'PENDIENTE_ATRASADO';
        }

        if (filtroMesGantt) {
          const mes = fAuditoria.split('-')[1];
          if (mes !== filtroMesGantt) return null;
        }

        if (filtroDiaGantt) {
          const dia = fAuditoria.split('-')[2];
          if (dia !== filtroDiaGantt.padStart(2, '0')) return null;
        }

        if (filtroCumplimientoGantt && estatus !== filtroCumplimientoGantt) return null;

        return {
          ...h,
          docId: auditoria.id,
          hallazgoIdx: idx,
          tipoAuditoria: tipoAuditoriaDoc,
          maquinaNombre: auditoria.maquinaNombre,
          ordenTrabajo: auditoria.ordenTrabajo,
          auditor: auditoria.auditor,
          fechaAuditoria: fAuditoria,
          fechaInicio: fAuditoria,
          fechaFin: fFin,
          estadoSeguimiento: estatus
        };
      })
      .filter(Boolean);
  });

  const diasGantt = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const diasLetra = ['D', 'L', 'M', 'MI', 'J', 'V', 'S'];
    return {
      iso,
      letra: diasLetra[d.getDay()],
      diaNum: d.getDate(),
      mesNum: d.getMonth() + 1
    };
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#0D1A2E' }}>
      
      {/* HEADER GLASS */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid rgba(0,32,96,0.08)',
        boxShadow: '0 2px 8px rgba(0,32,96,0.05)', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => setVista('LAUNCHER')}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', letterSpacing: '.02em' }}>IMPREDIMEX</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#003580', marginTop: '1px', letterSpacing: '.01em' }}>Control de Proceso y 5S</div>
            <div style={{ fontSize: '10px', color: '#8A9AB0', marginTop: '1px' }}>Sistema de Operaciones · Verificación de Línea</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {vista !== 'LAUNCHER' && (
            <button onClick={() => setVista('LAUNCHER')} style={{
              background: 'transparent', border: '1.5px solid rgba(0,32,96,0.12)', color: '#003580',
              padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
            }}>
              ← Tablero
            </button>
          )}
          <button onClick={() => { setVista('HISTORIAL'); setSubVistaHistorial('AUDITORIAS'); }} style={{
            background: '#003580', color: '#ffffff', border: 'none',
            padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, letterSpacing: '.02em'
          }}>
            Histórico ({historial.length})
          </button>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main style={{ maxWidth: '1220px', margin: '0 auto', padding: '1.2rem 1rem 3rem' }}>

        {/* 1. VISTA LAUNCHER */}
        {vista === 'LAUNCHER' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={STYLES.metricCard}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Total Auditorías</div>
                <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>{historial.length}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Registros sincronizados</div>
              </div>
              <div style={STYLES.metricCard}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Máquinas Activas</div>
                <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>26</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>En catálogo</div>
              </div>
              <div style={STYLES.metricCard}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Áreas y Máquinas 5S</div>
                <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>33</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Puntos de control</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              
              {/* Tarjeta Proceso */}
              <div onClick={() => setVista('MODULO_PROCESO')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Módulo Operativo</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Validación de Proceso</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Checklists de arranque, control de parámetros, solvente, mangas y liberación de tiro.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#0F7A55', background: '#E0F2EC', padding: '3px 9px', borderRadius: '5px' }}>
                  26 Equipos de Proceso
                </span>
              </div>

              {/* Tarjeta 5S */}
              <div onClick={() => setVista('MODULO_5S')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Módulo de Calidad</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Condiciones y 5S</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Auditoría de 20 puntos: orden, limpieza, condición de máquina, seguridad e infraestructura.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#003580', background: '#E8EEF8', padding: '3px 9px', borderRadius: '5px' }}>
                  33 Áreas y Máquinas
                </span>
              </div>

              {/* Tarjeta Editor de Formularios */}
              <div onClick={() => setVista('EDITOR_PLANTILLAS')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Configuración</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Editor de Plantillas (Proceso y 5S)</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Agrega, modifica o elimina preguntas técnicas de Proceso y listas de verificación 5S.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#003580', background: '#E8EEF8', padding: '3px 9px', borderRadius: '5px' }}>
                  Gestión Dinámica
                </span>
              </div>

            </div>
          </div>
        )}

        {/* 2. VISTA SELECCIÓN PROCESO */}
        {vista === 'MODULO_PROCESO' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Validación de Proceso y Arranque</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Selecciona el proceso y la máquina para iniciar la auditoría</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
            </div>

            <div style={{ ...STYLES.glassCard, maxWidth: '560px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                  1. Selecciona el Proceso / Familia:
                </label>
                <select
                  value={filtroProcesoFamilia}
                  onChange={(e) => {
                    setFiltroProcesoFamilia(e.target.value);
                    setFiltroProcesoMaquinaId('');
                  }}
                  style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                >
                  <option value="">-- Elige un proceso --</option>
                  {FAMILIAS_PROCESO.map((fam) => (
                    <option key={fam} value={fam}>{fam}</option>
                  ))}
                </select>
              </div>

              {filtroProcesoFamilia && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                    2. Selecciona la Máquina:
                  </label>
                  <select
                    value={filtroProcesoMaquinaId}
                    onChange={(e) => setFiltroProcesoMaquinaId(e.target.value)}
                    style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                  >
                    <option value="">-- Elige una máquina --</option>
                    {CATALOGO.filter((m) => m.moduloProceso && m.tipo === filtroProcesoFamilia).map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                disabled={!filtroProcesoMaquinaId}
                onClick={() => {
                  const m = CATALOGO.find((maq) => maq.id === filtroProcesoMaquinaId);
                  if (m) {
                    setMaquinaSeleccionada(m);
                    setTipoAuditoriaActiva('PROCESO');
                    setVista('EVALUACION');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: filtroProcesoMaquinaId ? '#003580' : '#E8EEF8',
                  color: filtroProcesoMaquinaId ? '#ffffff' : '#8A9AB0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: filtroProcesoMaquinaId ? 'pointer' : 'not-allowed'
                }}
              >
                Iniciar Auditoría de Proceso →
              </button>
            </div>
          </div>
        )}

        {/* 3. VISTA SELECCIÓN 5S */}
        {vista === 'MODULO_5S' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Condiciones de Equipo y 5S</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Selecciona el tipo de área/proceso y el equipo a auditar</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
            </div>

            <div style={{ ...STYLES.glassCard, maxWidth: '560px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                  1. Selecciona el Proceso o Área:
                </label>
                <select
                  value={filtro5SFamilia}
                  onChange={(e) => {
                    setFiltro5SFamilia(e.target.value);
                    setFiltro5SMaquinaId('');
                  }}
                  style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                >
                  <option value="">-- Elige un proceso / área --</option>
                  {FAMILIAS_5S.map((fam) => (
                    <option key={fam} value={fam}>{fam}</option>
                  ))}
                </select>
              </div>

              {filtro5SFamilia && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                    2. Selecciona la Máquina o Área Auxiliar:
                  </label>
                  <select
                    value={filtro5SMaquinaId}
                    onChange={(e) => setFiltro5SMaquinaId(e.target.value)}
                    style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                  >
                    <option value="">-- Elige la máquina o área específica --</option>
                    {CATALOGO.filter((m) => m.modulo5S && m.tipo === filtro5SFamilia).map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                disabled={!filtro5SMaquinaId}
                onClick={() => {
                  const m = CATALOGO.find((maq) => maq.id === filtro5SMaquinaId);
                  if (m) {
                    setMaquinaSeleccionada(m);
                    setTipoAuditoriaActiva('5S');
                    setVista('EVALUACION');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: filtro5SMaquinaId ? '#003580' : '#E8EEF8',
                  color: filtro5SMaquinaId ? '#ffffff' : '#8A9AB0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: filtro5SMaquinaId ? 'pointer' : 'not-allowed',
                  boxShadow: filtro5SMaquinaId ? '0 3px 10px rgba(0,53,128,0.3)' : 'none'
                }}
              >
                Iniciar Auditoría 5S (20 Puntos) →
              </button>
            </div>
          </div>
        )}

        {/* 4. VISTA DE EVALUACIÓN */}
        {vista === 'EVALUACION' && (
          <div>
            <div style={STYLES.glassCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                <div style={{ width: '3px', height: '18px', background: tipoAuditoriaActiva === '5S' ? '#d97706' : '#003580', borderRadius: '2px' }}></div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {tipoAuditoriaActiva === '5S' ? 'Auditoría de Condiciones de Equipo y 5S' : 'Auditoría Operativa de Proceso'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#002060' }}>{maquinaSeleccionada?.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                    Categoría: <strong>{maquinaSeleccionada?.tipo}</strong> · {itemsChecklistActivo.length} Puntos de Inspección
                  </div>
                </div>

                {itemsChecklistActivo.length > 0 && (
                  <div style={{ textAlign: 'right', background: '#E8EEF8', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,53,128,0.2)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase' }}>Cumplimiento</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: totalNo > 0 ? '#C8102E' : '#0F7A55' }}>
                      {cumplimiento}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#5A6A80' }}>{totalRespondidos} de {itemsChecklistActivo.length} evaluados</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '1.2rem', textAlign: 'left' }}>
                {tipoAuditoriaActiva === 'PROCESO' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Orden de Trabajo (OP):</label>
                    <input
                      type="text"
                      placeholder="Ej. OP-45920"
                      value={ordenTrabajo}
                      onChange={(e) => setOrdenTrabajo(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Auditor:</label>
                  <input
                    type="text"
                    placeholder="Nombre del auditor"
                    value={auditor}
                    onChange={(e) => setAuditor(e.target.value)}
                    style={STYLES.input}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Nómina auditado:</label>
                  <input
                    type="text"
                    placeholder="Ej. 1045"
                    value={nominaAuditado}
                    onChange={(e) => setNominaAuditado(e.target.value)}
                    style={STYLES.input}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Nómina supervisor:</label>
                  <input
                    type="text"
                    placeholder="Ej. 2012"
                    value={nominaSupervisor}
                    onChange={(e) => setNominaSupervisor(e.target.value)}
                    style={STYLES.input}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Turno:</label>
                  <select value={turno} onChange={(e) => setTurno(e.target.value)} style={STYLES.input}>
                    <option>Matutino (6:00–14:00)</option>
                    <option>Vespertino (14:00–21:30)</option>
                    <option>Nocturno (21:30–6:00)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Checklist Dinámico */}
            {itemsChecklistActivo.length > 0 ? (
              <div style={STYLES.glassCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Puntos de Inspección ({tipoAuditoriaActiva})
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {itemsChecklistActivo.map((item, idx) => {
                    const resp = respuestas[item.id];
                    const showHeader = idx === 0 || itemsChecklistActivo[idx - 1].seccion !== item.seccion;

                    return (
                      <React.Fragment key={item.id}>
                        {showHeader && (
                          <div style={{ background: '#E8EEF8', color: '#002060', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', marginTop: idx === 0 ? '0' : '14px', textAlign: 'left' }}>
                            {item.seccion}
                          </div>
                        )}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px', borderRadius: '8px',
                          border: resp === 'NO' ? '1.5px solid #C8102E' : '1.5px solid rgba(0,32,96,0.07)',
                          background: resp === 'NO' ? '#F9E8EB' : resp === 'SI' ? '#E0F2EC' : 'rgba(255,255,255,0.85)',
                          gap: '12px', flexWrap: 'wrap'
                        }}>
                          <div style={{ flex: '1 1 300px', textAlign: 'left' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: resp === 'NO' ? '#7A0B1D' : '#0D1A2E' }}>
                              <span style={{ color: '#003580', marginRight: '6px' }}>#{item.id}</span>
                              {item.queObservar}
                            </div>
                            <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                              <strong>Verificación:</strong> {item.comoVerifica}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleRespuesta(item.id, 'SI')}
                              style={{
                                padding: '6px 14px', borderRadius: '6px', border: 'none',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                background: resp === 'SI' ? '#0F7A55' : 'rgba(0,32,96,0.06)',
                                color: resp === 'SI' ? '#ffffff' : '#5A6A80'
                              }}
                            >
                              ✓ SÍ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespuesta(item.id, 'NO')}
                              style={{
                                padding: '6px 14px', borderRadius: '6px', border: 'none',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                background: resp === 'NO' ? '#C8102E' : 'rgba(0,32,96,0.06)',
                                color: resp === 'NO' ? '#ffffff' : '#5A6A80'
                              }}
                            >
                              ✕ NO
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ ...STYLES.glassCard, textAlign: 'left', padding: '16px 20px', background: '#f8fafc' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#002060', marginBottom: '4px' }}>
                  Sin preguntas registradas para {maquinaSeleccionada?.tipo}
                </div>
                <div style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5 }}>
                  Configura los puntos desde el <strong>Editor de Plantillas</strong> o registra observaciones con el botón <strong>"+ Agregar Hallazgo Extra"</strong>.
                </div>
              </div>
            )}

            {/* SECCIÓN HALLAZGOS Y ACCIONES */}
            <div style={{ ...STYLES.glassCard, border: listaHallazgos.length > 0 ? '1.5px solid #C8102E' : '1px solid rgba(0,32,96,0.07)', background: listaHallazgos.length > 0 ? '#F9E8EB' : 'rgba(255,255,255,0.88)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: listaHallazgos.length > 0 ? '2px solid rgba(200,16,46,0.2)' : '2px solid #E8EEF8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '18px', background: listaHallazgos.length > 0 ? '#C8102E' : '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: listaHallazgos.length > 0 ? '#7A0B1D' : '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Hallazgos y Acciones Correctivas ({listaHallazgos.length})
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddHallazgoExtra}
                  style={{
                    background: '#003580', color: '#ffffff', border: 'none',
                    padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '.02em'
                  }}
                >
                  + Agregar Hallazgo Extra
                </button>
              </div>

              {listaHallazgos.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#5A6A80', textAlign: 'center', padding: '14px 10px' }}>
                  No hay hallazgos registrados. Si una pregunta se marca como "NO" o agregas un hallazgo extra, aparecerá aquí.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {listaHallazgos.map((h) => {
                    const itemCheck = h.puntoId ? itemsChecklistActivo.find((i) => i.id === h.puntoId) : null;
                    return (
                      <div key={h.id} style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid rgba(200,16,46,0.25)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A0B1D' }}>
                            {h.esExtra ? '⚠️ Hallazgo Extra' : `Punto #${h.puntoId}: ${itemCheck?.queObservar}`}
                          </div>
                          {h.esExtra && (
                            <button
                              type="button"
                              onClick={() => handleRemoveHallazgoExtra(h.id)}
                              style={{ background: 'none', border: 'none', color: '#C8102E', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              ✕ Eliminar
                            </button>
                          )}
                        </div>

                        {/* Campo de descripción en todos los hallazgos */}
                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Descripción del Hallazgo:</label>
                          <input
                            type="text"
                            placeholder="Describe la desviación observada..."
                            value={h.hallazgo}
                            onChange={(e) => handleHallazgoChange(h.id, 'hallazgo', e.target.value)}
                            style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Acción Correctiva Inmediata:</label>
                            <input
                              type="text"
                              placeholder="Acción realizada..."
                              value={h.accion}
                              onChange={(e) => handleHallazgoChange(h.id, 'accion', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Responsable:</label>
                            <input
                              type="text"
                              placeholder="Nombre del responsable"
                              value={h.responsable}
                              onChange={(e) => handleHallazgoChange(h.id, 'responsable', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>
                              Fecha de Cierre:
                            </label>
                            <input
                              type="date"
                              value={h.fechaCierre}
                              readOnly={!h.esExtra}
                              onChange={(e) => handleHallazgoChange(h.id, 'fechaCierre', e.target.value)}
                              style={{
                                ...STYLES.input,
                                fontSize: '12px',
                                padding: '6px 10px',
                                background: !h.esExtra ? '#f1f5f9' : '#ffffff',
                                cursor: !h.esExtra ? 'not-allowed' : 'auto'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVista(tipoAuditoriaActiva === '5S' ? 'MODULO_5S' : 'MODULO_PROCESO')}
                style={{ padding: '11px 20px', background: 'transparent', border: '1.5px solid rgba(0,32,96,0.12)', color: '#003580', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleGuardarEvaluacion}
                style={{
                  padding: '11px 28px',
                  background: listaHallazgos.length === 0 ? '#003580' : '#C8102E',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 700, letterSpacing: '.02em',
                  cursor: guardando ? 'not-allowed' : 'pointer',
                  boxShadow: '0 3px 10px rgba(0,53,128,0.35)'
                }}
              >
                {guardando ? 'Guardando en Firebase…' : 'Guardar Registro de Auditoría'}
              </button>
            </div>
          </div>
        )}

        {/* 5. VISTA EDITOR DE PLANTILLAS */}
        {vista === 'EDITOR_PLANTILLAS' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Editor de Plantillas y Checklists</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Configuración integral para Proceso y Condiciones 5S</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver al Tablero
              </button>
            </div>

            <div style={{ ...STYLES.glassCard, padding: '16px', marginBottom: '1rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModuloEditor('PROCESO');
                    setTipoSeleccionadoEditor('Flexografía');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: moduloEditor === 'PROCESO' ? '#003580' : '#E8EEF8',
                    color: moduloEditor === 'PROCESO' ? '#ffffff' : '#003580'
                  }}
                >
                  ⚙️ Checklists de Proceso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModuloEditor('5S');
                    setTipoSeleccionadoEditor('Flexografía');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: moduloEditor === '5S' ? '#003580' : '#E8EEF8',
                    color: moduloEditor === '5S' ? '#ffffff' : '#003580'
                  }}
                >
                  🧹 Checklists de Condiciones 5S
                </button>
              </div>

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                Selecciona la Familia o Categoría de {moduloEditor}:
              </label>
              <select
                value={tipoSeleccionadoEditor}
                onChange={(e) => setTipoSeleccionadoEditor(e.target.value)}
                style={{ ...STYLES.input, maxWidth: '320px', fontWeight: 600 }}
              >
                {(moduloEditor === 'PROCESO' ? FAMILIAS_PROCESO : FAMILIAS_5S).map((fam) => (
                  <option key={fam} value={fam}>{fam}</option>
                ))}
              </select>
            </div>

            {/* Formulario Agregar / Modificar */}
            <div style={{ ...STYLES.glassCard, textAlign: 'left', border: editandoId !== null ? '1.5px solid #003580' : '1px solid rgba(255, 255, 255, 0.98)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                <div style={{ width: '3px', height: '18px', background: editandoId !== null ? '#16a34a' : '#003580', borderRadius: '2px' }}></div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {editandoId !== null
                    ? `✏️ Modificar Punto #${editandoId} (${moduloEditor} - ${tipoSeleccionadoEditor})`
                    : `+ Agregar Nuevo Punto a "${tipoSeleccionadoEditor}" (${moduloEditor})`}
                </div>
              </div>

              <form onSubmit={handleGuardarOEditarPregunta}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '3px' }}>
                      {moduloEditor === '5S' ? 'Pilar 5S / Sección:' : 'Sección / Categoría:'}
                    </label>
                    <input
                      type="text"
                      placeholder={moduloEditor === '5S' ? 'Ej. 1. ORDEN Y 5S' : 'Ej. A · SOLVENTE Y APORTE'}
                      value={nuevaSeccion}
                      onChange={(e) => setNuevaSeccion(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '3px' }}>Qué observar en piso:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Bandejas libres de derrames y herramientas delimitadas"
                      value={nuevoQueObservar}
                      onChange={(e) => setNuevoQueObservar(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '3px' }}>Cómo se verifica:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Inspección visual directa y revisión de delimitaciones"
                      value={nuevoComoVerifica}
                      onChange={(e) => setNuevoComoVerifica(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    style={{
                      background: editandoId !== null ? '#0F7A55' : '#003580',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {editandoId !== null ? '✓ Guardar Cambios del Punto' : '+ Agregar Punto a la Lista'}
                  </button>
                  {editandoId !== null && (
                    <button
                      type="button"
                      onClick={cancelarEdicionPregunta}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(0,32,96,0.12)',
                        color: '#5A6A80',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Lista de Preguntas */}
            <div style={{ ...STYLES.glassCard, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Puntos de Revisión ({checklistEnEdicion.length})
                  </div>
                </div>

                <button
                  type="button"
                  disabled={guardandoPlantilla}
                  onClick={handleGuardarPlantillaEnFirebase}
                  style={{
                    background: '#0F7A55', color: '#ffffff', border: 'none',
                    padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                    cursor: guardandoPlantilla ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(15,122,85,0.3)'
                  }}
                >
                  {guardandoPlantilla ? 'Guardando en la Nube…' : `💾 Guardar Plantilla de ${moduloEditor} en Firebase`}
                </button>
              </div>

              {checklistEnEdicion.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#5A6A80', fontSize: '13px' }}>
                  No hay preguntas configuradas para esta categoría de {moduloEditor}. Agrega la primera arriba.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {checklistEnEdicion.map((item) => {
                    const estaSiendoEditado = editandoId === item.id;
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px', borderRadius: '8px',
                          border: estaSiendoEditado ? '1.5px solid #003580' : '1px solid rgba(0,32,96,0.07)',
                          background: estaSiendoEditado ? '#E8EEF8' : '#ffffff', gap: '10px', flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ flex: '1 1 300px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', marginBottom: '2px' }}>
                            {item.seccion}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0D1A2E' }}>
                            #{item.id} {item.queObservar}
                          </div>
                          <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                            <strong>Verificación:</strong> {item.comoVerifica}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => iniciarEdicionPregunta(item)}
                            style={{
                              background: '#E8EEF8', color: '#002060', border: 'none',
                              padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarPregunta(item.id)}
                            style={{
                              background: '#F9E8EB', color: '#C8102E', border: 'none',
                              padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            🗑 Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 6. VISTA HISTORIAL & GANTT */}
        {vista === 'HISTORIAL' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Histórico y Cronograma Gantt</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Consolidación de auditorías ({historial.length}) y plan de acción</div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSubVistaHistorial('AUDITORIAS')}
                  style={{
                    background: subVistaHistorial === 'AUDITORIAS' ? '#003580' : 'transparent',
                    color: subVistaHistorial === 'AUDITORIAS' ? '#ffffff' : '#003580',
                    border: '1.5px solid #003580', padding: '6px 14px', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Auditorías ({historial.length})
                </button>
                <button
                  onClick={() => setSubVistaHistorial('GANTT')}
                  style={{
                    background: subVistaHistorial === 'GANTT' ? '#003580' : 'transparent',
                    color: subVistaHistorial === 'GANTT' ? '#ffffff' : '#003580',
                    border: '1.5px solid #003580', padding: '6px 14px', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Tabla Gantt ({hallazgosFiltradosGantt.length})
                </button>
                <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#5A6A80', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
            </div>

            {/* A. TABLA GANTT */}
            {subVistaHistorial === 'GANTT' && (
              <div>
                <div style={{ ...STYLES.glassCard, padding: '16px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Filtros de Búsqueda para Cronograma
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', alignItems: 'center' }}>
                    
                    <select
                      value={filtroOrigenGantt}
                      onChange={(e) => setFiltroOrigenGantt(e.target.value)}
                      style={STYLES.input}
                    >
                      <option value="">Todos los módulos</option>
                      <option value="PROCESO">Validación de Proceso</option>
                      <option value="5S">Condiciones y 5S</option>
                    </select>

                    <select
                      value={filtroMaquinaGantt}
                      onChange={(e) => setFiltroMaquinaGantt(e.target.value)}
                      style={STYLES.input}
                    >
                      <option value="">Todas las máquinas y áreas</option>
                      {CATALOGO.map((m) => (
                        <option key={m.id} value={m.nombre}>{m.nombre}</option>
                      ))}
                    </select>

                    <select
                      value={filtroMesGantt}
                      onChange={(e) => setFiltroMesGantt(e.target.value)}
                      style={STYLES.input}
                    >
                      <option value="">Todos los meses</option>
                      <option value="01">Enero</option>
                      <option value="02">Febrero</option>
                      <option value="03">Marzo</option>
                      <option value="04">Abril</option>
                      <option value="05">Mayo</option>
                      <option value="06">Junio</option>
                      <option value="07">Julio</option>
                      <option value="08">Agosto</option>
                      <option value="09">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Día (1–31)"
                      value={filtroDiaGantt}
                      onChange={(e) => setFiltroDiaGantt(e.target.value)}
                      style={STYLES.input}
                    />

                    <select
                      value={filtroCumplimientoGantt}
                      onChange={(e) => setFiltroCumplimientoGantt(e.target.value)}
                      style={STYLES.input}
                    >
                      <option value="">Todos los estados</option>
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="TERMINADO">TERMINADO</option>
                      <option value="PENDIENTE_ATRASADO">PENDIENTE ATRASADO</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setFiltroOrigenGantt('');
                        setFiltroMaquinaGantt('');
                        setFiltroMesGantt('');
                        setFiltroDiaGantt('');
                        setFiltroCumplimientoGantt('');
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(0,32,96,0.12)',
                        color: '#5A6A80',
                        padding: '10px 8px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Limpiar Filtros
                    </button>
                  </div>
                </div>

                <div style={{ ...STYLES.glassCard, padding: '16px', overflowX: 'auto' }}>
                  {hallazgosFiltradosGantt.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#5A6A80', fontSize: '13px' }}>
                      No se encontraron hallazgos registrados para el criterio seleccionado.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr style={{ background: '#002060', color: '#ffffff', textAlign: 'center' }}>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '28px' }} rowSpan={2}>#</th>
                          <th style={{ padding: '8px 8px', border: '1px solid #1A4D9A', width: '85px' }} rowSpan={2}>Fecha Auditoría</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', textAlign: 'left', minWidth: '130px' }} rowSpan={2}>Máquina / Área</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', textAlign: 'left', minWidth: '220px' }} rowSpan={2}>Actividad / Hallazgo</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', textAlign: 'left', minWidth: '110px' }} rowSpan={2}>Responsable</th>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '70px' }} rowSpan={2}>Inicio</th>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '70px' }} rowSpan={2}>Fin</th>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '40px' }} rowSpan={2}>Días</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', minWidth: '120px' }} rowSpan={2}>Cumplimiento</th>

                          <th colSpan={7} style={{ border: '1px solid #1A4D9A', padding: '4px', background: '#003580', fontSize: '11px', fontWeight: 700 }}>
                            Semana 1 ({diasGantt[0].mesNum}/{diasGantt[0].diaNum})
                          </th>
                          <th colSpan={7} style={{ border: '1px solid #1A4D9A', padding: '4px', background: '#1A4D9A', fontSize: '11px', fontWeight: 700 }}>
                            Semana 2 ({diasGantt[7].mesNum}/{diasGantt[7].diaNum})
                          </th>
                        </tr>

                        <tr style={{ background: '#003580', color: '#ffffff', textAlign: 'center' }}>
                          {diasGantt.map((d, i) => (
                            <th key={i} style={{ padding: '4px 3px', border: '1px solid #1A4D9A', width: '22px', fontSize: '10px' }}>
                              {d.letra}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {hallazgosFiltradosGantt.map((item: any, idx: number) => {
                          const estatus: EstadoCumplimiento = item.estadoSeguimiento || 'PENDIENTE';
                          
                          const dIni = new Date(item.fechaInicio);
                          const dFin = new Date(item.fechaFin);
                          const diffTime = Math.abs(dFin.getTime() - dIni.getTime());
                          const diasTotal = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

                          return (
                            <tr key={`${item.docId}_${idx}`} style={{ borderBottom: '1px solid #E8EEF8', background: idx % 2 === 0 ? '#ffffff' : '#f8f9ff' }}>
                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center', fontWeight: 700, color: '#003580' }}>
                                {idx + 1}
                              </td>

                              <td style={{ padding: '6px 6px', border: '1px solid #E8EEF8', textAlign: 'center', color: '#002060', fontWeight: 600 }}>
                                {item.fechaAuditoria}
                              </td>

                              <td style={{ padding: '6px 10px', border: '1px solid #E8EEF8', textAlign: 'left' }}>
                                <span style={{ fontWeight: 700, color: '#003580', background: '#E8EEF8', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                  {item.maquinaNombre}
                                </span>
                              </td>

                              <td style={{ padding: '6px 10px', border: '1px solid #E8EEF8', textAlign: 'left' }}>
                                <div style={{ fontWeight: 600, color: '#0D1A2E' }}>{item.hallazgo}</div>
                                <div style={{ fontSize: '10px', color: '#8A9AB0' }}>
                                  {item.tipoAuditoria === '5S' ? '5S' : `OP: ${item.ordenTrabajo || 'S/N'}`} · {item.accion || 'Sin acción'}
                                </div>
                              </td>

                              <td style={{ padding: '6px 10px', border: '1px solid #E8EEF8', textAlign: 'left', color: '#5A6A80' }}>
                                {item.responsable || 'No asignado'}
                              </td>

                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center', color: '#5A6A80' }}>
                                {item.fechaInicio}
                              </td>

                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center', color: '#5A6A80' }}>
                                {item.fechaFin}
                              </td>

                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center', fontWeight: 700, color: '#002060' }}>
                                {diasTotal}
                              </td>

                              <td style={{ padding: '6px 8px', border: '1px solid #E8EEF8', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleToggleEstadoHallazgo(item.docId, item.hallazgoIdx, item.estadoSeguimiento)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    width: '100%',
                                    background:
                                      estatus === 'TERMINADO' ? '#E0F2EC' :
                                      estatus === 'PENDIENTE_ATRASADO' ? '#F9E8EB' : '#FDF0D8',
                                    color:
                                      estatus === 'TERMINADO' ? '#085041' :
                                      estatus === 'PENDIENTE_ATRASADO' ? '#7A0B1D' : '#7A4500'
                                  }}
                                  title="Haz clic para alternar: PENDIENTE → TERMINADO → PENDIENTE ATRASADO"
                                >
                                  {estatus === 'PENDIENTE_ATRASADO' ? 'PEND. ATRASADO' : estatus}
                                </button>
                              </td>

                              {diasGantt.map((diaCol, dIdx) => {
                                const celdaEnRango = diaCol.iso >= item.fechaInicio && diaCol.iso <= item.fechaFin;
                                let bgCelda = 'transparent';

                                if (celdaEnRango) {
                                  bgCelda =
                                    estatus === 'TERMINADO' ? '#0F7A55' :
                                    estatus === 'PENDIENTE_ATRASADO' ? '#C8102E' : '#D4840A';
                                }

                                return (
                                  <td
                                    key={dIdx}
                                    style={{
                                      border: '1px solid rgba(0,32,96,0.06)',
                                      background: bgCelda,
                                      padding: 0,
                                      height: '24px'
                                    }}
                                    title={`${diaCol.iso} - ${estatus}`}
                                  ></td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* B. SUBVISTA AUDITORÍAS GENERALES */}
            {subVistaHistorial === 'AUDITORIAS' && (
              <div>
                {historial.length === 0 ? (
                  <div style={{ ...STYLES.glassCard, textAlign: 'center', padding: '2.5rem', color: '#5A6A80', fontSize: '13px' }}>
                    Sin auditorías guardadas aún en la colección activa.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {historial.map((item) => (
                      <div key={item.id} style={{ ...STYLES.glassCard, marginBottom: 0, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0D1A2E' }}>{item.maquinaNombre}</span>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                              background: item.estadoFinal === 'APROBADO' ? '#E0F2EC' : '#F9E8EB',
                              color: item.estadoFinal === 'APROBADO' ? '#085041' : '#7A0B1D'
                            }}>
                              {item.estadoFinal === 'APROBADO' ? '✓ APROBADO' : '⚠️ CON HALLAZGOS'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#003580', background: '#E8EEF8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              {item.tipoAuditoria || 'PROCESO'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#5A6A80' }}>
                            Fecha: <strong>{item.fechaAuditoria || todayStr}</strong> · {item.tipoAuditoria === '5S' ? '' : `OP: ${item.ordenTrabajo || 'S/N'} · `}Auditor: <strong>{item.auditor}</strong> · {item.turno}
                          </div>
                          {(item.nominaAuditado || item.nominaSupervisor) && (
                            <div style={{ fontSize: '11px', color: '#8A9AB0', marginTop: '2px' }}>
                              Auditado (Nóm): <strong>{item.nominaAuditado || 'N/A'}</strong> · Supervisor (Nóm): <strong>{item.nominaSupervisor || 'N/A'}</strong>
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: item.cumplimiento === 100 ? '#0F7A55' : '#C8102E' }}>
                            {item.cumplimiento}%
                          </div>
                          <div style={{ fontSize: '10px', color: '#8A9AB0' }}>
                            {item.totalSi} SÍ / {item.totalNo} NO · {item.hallazgos?.length || 0} Hallazgos
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer style={{ textAlign: 'center', padding: '1.2rem', fontSize: '11px', color: '#8A9AB0', borderTop: '1px solid rgba(0,32,96,0.07)' }}>
        <strong style={{ color: '#003580' }}>IMPREDIMEX</strong> — Impresión y Diseño de México S.A. de C.V. &nbsp;·&nbsp; Sistema de Control Operativo &nbsp;·&nbsp; Planta Industrial
      </footer>
    </div>
  );
};

export default App;
