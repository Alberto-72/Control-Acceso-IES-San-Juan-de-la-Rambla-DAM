import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Platform, SafeAreaView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

const API_URL = 'http://10.102.7.200:3001/api/verificar-tarjeta'; 

export default function ScannerScreen({ route, navigation }) {
  const [alumno, setAlumno] = useState(null);
  const [escaneando, setEscaneando] = useState(false);

  // Detectamos si la directiva ha activado el modo guardia
  const esModoGuardiaDirectiva = route.params?.modoGuardia === true;

  useEffect(() => {
    async function initNfc() {
      try {
        if (Platform.OS !== 'web' && NfcManager) {
            const supported = await NfcManager.isSupported();
            if (supported) await NfcManager.start();
        }
      } catch (ex) {
        console.warn("Error iniciando NFC:", ex)
      }
    }
    initNfc();
    return () => { 
        if (Platform.OS !== 'web' && NfcManager) {
            NfcManager.cancelTechnologyRequest().catch(() => 0); 
        }
    };
  }, []);

  useEffect(() => {
    if (route.params?.studentToValidate) {
      const datosManuales = route.params.studentToValidate;
      procesarValidacion({
        nombre: datosManuales.nombre,
        curso: datosManuales.cursoCorto || datosManuales.curso,
        foto: datosManuales.foto || null,
        fechaNacimiento: datosManuales.fechaNacimiento,
        tieneTransporte: datosManuales.tieneTransporte
      });
      navigation.setParams({ studentToValidate: undefined });
    }
  }, [route.params?.studentToValidate]);

  const esMayorDeEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return false;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad >= 18;
  };

  const procesarValidacion = (datosAlumno) => {
    const esAdulto = esMayorDeEdad(datosAlumno.fechaNacimiento);
    if (esAdulto) {
      setAlumno({ ...datosAlumno, autorizado: true, estado: 'exito', mensajeEstado: 'AUTORIZADO' });
      return;
    }
    if (datosAlumno.tieneTransporte) {
      setAlumno({ ...datosAlumno, autorizado: true, estado: 'precaucion', mensajeEstado: 'Menor con transporte' });
      return;
    }
    Alert.alert(
      "Control de Menores",
      `El alumno ${datosAlumno.nombre} es menor y NO tiene transporte.\n\n¿Va acompañado de un adulto?`,
      [
        {
          text: "NO - Denegar",
          style: "destructive",
          onPress: () => setAlumno({ ...datosAlumno, autorizado: false, estado: 'error', mensajeEstado: 'Salida denegada' })
        },
        {
          text: "SÍ - Autorizar",
          onPress: () => setAlumno({ ...datosAlumno, autorizado: true, estado: 'precaucion', mensajeEstado: 'Autorizado por adulto' })
        }
      ]
    );
  };

  const leerNFC = async () => {
    if (Platform.OS === 'web') {
        Alert.alert("NFC No Disponible", "El escaneo NFC solo funciona en dispositivos móviles.");
        return;
    }
    try {
      setEscaneando(true);
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() =>
        NfcManager.requestTechnology(NfcTech.NfcA)
      );
      const tag = await NfcManager.getTag();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarjetaId: tag.id })
      });
      const data = await response.json();
      if (data.success) {
        procesarValidacion({
          nombre: data.nombre,
          curso: data.curso || 'Sin curso',
          foto: data.foto || null,
          fechaNacimiento: data.fechaNacimiento,
          tieneTransporte: data.tieneTransporte
        });
      } else {
        setAlumno({ nombre: 'Desconocido', curso: 'UID: ' + tag.id, autorizado: false, estado: 'error', mensajeEstado: 'NO REGISTRADO' });
      }
    } catch (networkError) {
      Alert.alert("Error", "No se puede conectar con el servidor.");
    } finally {
      if (NfcManager) NfcManager.cancelTechnologyRequest();
      setEscaneando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* CABECERA DE CONVERSIÓN: Indica que estás en modo profesorado */}
      {esModoGuardiaDirectiva && (
        <View style={styles.headerModoGuardia}>
          <View>
            <Text style={styles.txtModo}>MODO PROFESORADO</Text>
            <Text style={styles.txtSubModo}>Control de Guardia Activo</Text>
          </View>
          <TouchableOpacity 
            style={styles.btnSalirModo} 
            onPress={() => navigation.navigate('Profesores')} // Vuelve a la gestión de directiva
          >
            <Feather name="log-out" size={16} color="white" />
            <Text style={styles.textBtnSalir}> SALIR</Text>
          </TouchableOpacity>
        </View>
      )}

      {!alumno ? (
        <View style={styles.cajaBlanca}>
          <View style={[styles.circuloIcono, escaneando && styles.circuloIconoActivo]}>
            <Ionicons name={escaneando ? "hourglass-outline" : "radio-outline"} size={80} color={escaneando ? "#15803D" : "#2563EB"} />
          </View>
          <Text style={styles.tituloVacio}>{escaneando ? "Conectando..." : "Escáner de Guardia"}</Text>
          <Text style={styles.subtituloVacio}>Pase la tarjeta por el lector o use la búsqueda manual.</Text>

          {!escaneando ? (
            <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
              <Ionicons name="radio" size={30} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.botonGrande, { backgroundColor: '#EF4444' }]} onPress={() => setEscaneando(false)}>
              <Text style={styles.textoBotonGrande}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.tarjetaAlumnoContainer}>
          <View style={styles.tarjeta}>
            <View style={[styles.avatar, { borderColor: alumno.estado === 'error' ? "#DC2626" : "#15803D" }]}>
              {alumno.foto ? (
                <Image source={{ uri: `data:image/png;base64,${alumno.foto}` }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={60} color="#9CA3AF" />
              )}
            </View>
            <Text style={styles.nombreAlumno}>{alumno.nombre}</Text>
            <Text style={styles.cursoAlumno}>{alumno.curso}</Text>
            
            <View style={alumno.estado === 'error' ? styles.badgeError : alumno.estado === 'precaucion' ? styles.badgePrecaucion : styles.badgeExito}>
               <Text style={alumno.estado === 'error' ? styles.textoError : alumno.estado === 'precaucion' ? styles.textoPrecaucion : styles.textoExito}>
                 {alumno.mensajeEstado}
               </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.botonSiguiente} onPress={() => setAlumno(null)}>
            <Text style={styles.textoBotonSiguiente}>SIGUIENTE / LISTO</Text>
            <Ionicons name="arrow-forward" size={24} color="white" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center' },
  cajaBlanca: { backgroundColor: 'white', margin: 20, padding: 30, borderRadius: 20, alignItems: 'center', elevation: 4 },
  circuloIcono: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circuloIconoActivo: { backgroundColor: '#DCFCE7' },
  tituloVacio: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 10 },
  subtituloVacio: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 30 },
  botonGrande: { backgroundColor: '#2563EB', flexDirection: 'row', padding: 18, borderRadius: 15, width: '100%', justifyContent: 'center', alignItems: 'center' },
  textoBotonGrande: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  tarjetaAlumnoContainer: { padding: 20 },
  tarjeta: { backgroundColor: 'white', padding: 25, borderRadius: 25, alignItems: 'center', elevation: 8 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 5, marginBottom: 15, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  nombreAlumno: { fontSize: 26, fontWeight: 'bold', color: '#111827' },
  cursoAlumno: { fontSize: 18, color: '#6B7280', marginBottom: 20 },
  badgeExito: { backgroundColor: '#DCFCE7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  textoExito: { color: '#15803D', fontWeight: 'bold', fontSize: 18 },
  badgeError: { backgroundColor: '#FEF2F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  textoError: { color: '#DC2626', fontWeight: 'bold', fontSize: 18 },
  badgePrecaucion: { backgroundColor: '#FEF9C3', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, elevation: 2 },
  textoPrecaucion: { color: '#A16207', fontWeight: 'bold', fontSize: 16 },
  botonSiguiente: { backgroundColor: '#2563EB', marginTop: 20, flexDirection: 'row', padding: 18, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  textoBotonSiguiente: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});