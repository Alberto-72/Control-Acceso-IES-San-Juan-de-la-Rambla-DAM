//React and React Native main imports
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, StatusBar as RNStatusBar, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

//Express server URL connecting to Odoo
const API_URL = 'http://10.102.8.22:3001/api/verificar-tarjeta';

//Root component of the application
export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

//Main screen with NFC logic and tab navigation
function MainScreen() {
  const [tabActiva, setTabActiva] = useState(0);
  const [alumno, setAlumno] = useState(null); 
  const [escaneando, setEscaneando] = useState(false);

  //NFC module initialization on component mount
  useEffect(() => {
    async function initNfc() {
      try {
        const supported = await NfcManager.isSupported();
        if (supported) {
          await NfcManager.start();
        } else {
          Alert.alert("Aviso", "Tu dispositivo no soporta NFC.");
        }
      } catch (ex) {
        console.warn("Error iniciando NFC:", ex);
      }
    }
    initNfc();

    //Clean up NFC request on unmount
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  //Function that reads the NFC card and queries the server
  const leerNFC = async () => {
    try {
      setEscaneando(true);

      //Try NDEF first, fallback to NfcA
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() => 
         NfcManager.requestTechnology(NfcTech.NfcA)
      );

      //Get tag and its ID
      const tag = await NfcManager.getTag();
      const idLeido = tag.id;
      console.log("ID Leido del chip:", idLeido);

      try {
        //Send UID to server for Odoo verification
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tarjetaId: idLeido })
        });

        const data = await response.json();
        console.log("Respuesta del Servidor:", data);

        //If student exists in Odoo, save their data (name, photo, school year)
        if (data.success) {
          setAlumno({
            nombre: data.nombre,
            curso: data.curso || 'Sin curso asignado',
            foto: data.foto || null,
            autorizado: true
          });
        } else {
          //Student not found: show as unknown
          setAlumno({
            nombre: 'Desconocido',
            curso: 'UID: ' + idLeido,
            foto: null,
            autorizado: false
          });
        }

      } catch (networkError) {
        console.error("Error de red:", networkError);
        Alert.alert("Error", "No se puede conectar con el servidor.");
      }

    } catch (ex) {
      console.warn("NFC Cancelado o Error:", ex);
      setEscaneando(false);
    } finally {
      //Always release NFC request
      NfcManager.cancelTechnologyRequest();
      setEscaneando(false);
    }
  };

  //Reset state to scan another card
  const reiniciar = () => {
    setAlumno(null);
    setEscaneando(false);
  };

  //Render content based on active tab and student state
  const renderContent = () => {
    if (tabActiva === 0) {

      //Initial state: waiting for scan
      if (!alumno) {
        return (
          <View style={styles.cajaBlanca}>
            {/*Central icon based on scan state*/}
            <View style={[styles.circuloIcono, escaneando && styles.circuloIconoActivo]}>
              <Ionicons 
                name={escaneando ? "hourglass-outline" : "radio-outline"} 
                size={80} 
                color={escaneando ? "#15803D" : "#2563EB"} 
                style={!escaneando && { transform: [{ rotate: '90deg' }] }}
              />
            </View>
            <Text style={styles.tituloVacio}>
              {escaneando ? "Conectando..." : "Control de Acceso"}
            </Text>
            <Text style={styles.subtituloVacio}>
              {escaneando ? "Validando en Odoo..." : "Pulsa y acerca la tarjeta."}
            </Text>

            {/*Button to start NFC scan*/}
            {!escaneando && (
              <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
                <Ionicons name="radio" size={30} color="white" style={{marginRight: 10, transform: [{ rotate: '90deg' }]}} />
                <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
              </TouchableOpacity>
            )}

            {/*Button to cancel ongoing scan*/}
            {escaneando && (
              <TouchableOpacity style={[styles.botonGrande, {backgroundColor: '#EF4444'}]} onPress={() => {
                  NfcManager.cancelTechnologyRequest();
                  setEscaneando(false);
              }}>
                <Text style={styles.textoBotonGrande}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      } else {
        //Result state: show student data
        return (
          <>
            <View style={styles.tarjeta}>
              {/*Avatar: shows student photo if available, generic icon otherwise*/}
              <View style={[styles.avatar, !alumno.autorizado && {borderColor: '#DC2626', borderWidth: 2}]}>
                {alumno.foto ? (
                  <Image 
                    source={{ uri: `data:image/png;base64,${alumno.foto}` }} 
                    style={styles.avatarImage} 
                  />
                ) : (
                  <Ionicons name="person" size={60} color={!alumno.autorizado ? "#DC2626" : "#9CA3AF"} />
                )}
              </View>
              
              {/*Student full name*/}
              <Text style={styles.nombreAlumno}>{alumno.nombre}</Text>

              {/*Student school year*/}
              <Text style={styles.cursoAlumno}>{alumno.curso}</Text>

              {/*Status badge: authorized or not registered*/}
              {alumno.autorizado ? (
                <View style={styles.badgeExito}>
                  <Ionicons name="checkmark-circle" size={24} color="#15803D" style={{marginRight: 8}} />
                  <Text style={styles.textoExito}>AUTORIZADO</Text>
                </View>
              ) : (
                <View style={styles.badgeError}>
                  <Ionicons name="close-circle" size={24} color="#DC2626" style={{marginRight: 8}} />
                  <Text style={styles.textoError}>NO REGISTRADO</Text>
                </View>
              )}
            </View>

            {/*Button to scan next card*/}
            <TouchableOpacity style={styles.botonSiguiente} onPress={reiniciar}>
              <Ionicons name="arrow-forward" size={24} color="white" style={{marginRight: 10}} />
              <Text style={styles.textoBotonSiguiente}>Leer Siguiente</Text>
            </TouchableOpacity>
          </>
        );
      }
    }
    //Tabs 1 and 2: coming soon
    return <View style={styles.cajaVacia}><Text>Proximamente...</Text></View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#2563EB" />

      {/*Application header*/}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Control Guardia</Text>
        <Text style={styles.headerSubtitle}>IES San Juan de la Rambla</Text>
      </View>

      {/*Main content area*/}
      <View style={styles.content}>{renderContent()}</View>

      {/*Bottom navigation bar with 3 tabs*/}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => setTabActiva(0)} style={styles.tabItem}>
          <Ionicons name="radio" size={28} color={tabActiva === 0 ? "#2563EB" : "#9CA3AF"} style={{ transform: [{ rotate: '90deg' }] }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTabActiva(1)} style={styles.tabItem}>
          <Ionicons name="people" size={28} color={tabActiva === 1 ? "#2563EB" : "#9CA3AF"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTabActiva(2)} style={styles.tabItem}>
          <Ionicons name="settings" size={28} color={tabActiva === 2 ? "#2563EB" : "#9CA3AF"} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

//Application styles
const styles = StyleSheet.create({
  //Main container
  container: { 
    flex: 1, 
    backgroundColor: '#F3F4F6', 
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 
  },
  //Blue header with rounded bottom corners
  header: { 
    backgroundColor: '#2563EB', 
    padding: 20, 
    paddingBottom: 40, 
    borderBottomLeftRadius: 20, 
    borderBottomRightRadius: 20, 
    alignItems: 'center',
    zIndex: 10
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 14, color: '#E0E7FF', marginTop: 4 },
  //Central content area
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: -30 },
  //White card for initial scan state
  cajaBlanca: { 
    backgroundColor: 'white', width: '100%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  //NFC icon circle
  circuloIcono: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circuloIconoActivo: { backgroundColor: '#DCFCE7' },
  //Initial state texts
  tituloVacio: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 10 },
  subtituloVacio: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 30 },
  //Main scan button
  botonGrande: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textoBotonGrande: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  //Student result card
  tarjeta: { backgroundColor: 'white', width: '100%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, marginBottom: 20 },
  //Circular avatar with green border (authorized) or red (not registered)
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', marginBottom: 16, overflow: 'hidden' },
  //Avatar image (student photo from Odoo)
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  //Student name
  nombreAlumno: { fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  //Student school year
  cursoAlumno: { fontSize: 16, color: '#6B7280', marginBottom: 20 },
  //Green authorized badge
  badgeExito: { flexDirection: 'row', backgroundColor: '#DCFCE7', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoExito: { color: '#15803D', fontWeight: 'bold', fontSize: 16 },
  //Red not registered badge
  badgeError: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoError: { color: '#DC2626', fontWeight: 'bold', fontSize: 16 },
  //Scan next card button
  botonSiguiente: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  textoBotonSiguiente: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  //Bottom navigation bar
  footer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: 60 },
  //Placeholder for unimplemented tabs
  cajaVacia: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});