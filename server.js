//Express server connecting the mobile app with Odoo
const express = require('express');
const cors = require('cors');
const Odoo = require('odoo-xmlrpc');

const app = express();
app.use(cors());
app.use(express.json());

//Odoo connection settings
const odooConfig = {
    url: 'http://10.102.7.237',
    port: 8069,
    db: 'ControlAcceso',
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

//Test route to check if the server is running
app.get('/', (req, res) => {
    res.send('Servidor Odoo funcionando correctamente.');
});

//Main route: receives the NFC card UID and queries Odoo
app.post('/api/verificar-tarjeta', (req, res) => {
    const { tarjetaId } = req.body;
    console.log(`\nUID Recibido: ${tarjetaId} -> Consultando Odoo...`);

    //Create Odoo connection instance
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, error: 'Fallo conexion Odoo' });
        }

        //Search in gestion_entrada.alumno model by UID
        //Requested fields: name, surname, photo (binary), school_year (selection)
        odoo.execute_kw(
            'gestion_entrada.alumno', 
            'search_read', 
            [
                [[['uid', '=', tarjetaId]]], 
                {
                    fields: ['name', 'surname', 'photo', 'school_year'],
                    limit: 1
                }
            ],(err, result) => {
            if (err) {
                console.error('Error en busqueda Odoo:', err);
                return res.status(500).json({ success: false, error: err });
            }

            //If student is found, return their full data
            if (result && result.length > 0) {

                const alumno = result[0];
                const nombreCompleto = `${alumno.name} ${alumno.surname}`;

                //Debug: show all keys and their types from Odoo response
                for (const key of Object.keys(alumno)) {
                    if (key === 'photo') {
                        console.log(`  ${key}: [foto encontrada]`);
                    } else {
                        console.log(`  ${key}: ${JSON.stringify(alumno[key])} (${typeof alumno[key]})`);
                    }
                }

                //Student found log
                console.log(`ALUMNO ENCONTRADO: ${nombreCompleto}`);
                console.log(`Foto: ${alumno.photo ? 'foto encontrada' : 'sin foto'}`);

                //Handle school_year: Odoo returns false for empty selection fields via XML-RPC
                const curso = (alumno.school_year !== undefined && alumno.school_year !== false && alumno.school_year !== null)
                    ? alumno.school_year
                    : null;
                console.log(`Curso enviado: ${curso}`);

                //JSON response with all student data
                return res.json({
                    success: true,
                    nombre: nombreCompleto,
                    foto: alumno.photo || null,
                    curso: curso,
                    autorizado: true
                });
            } else {
                //UID not found in database
                console.log(`UID ${tarjetaId} no existe en la base de datos.`);

                return res.json({
                    success: false,
                    message: "Tarjeta no registrada"
                });
            }
        });
    });
});

//Start server on port 3001
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
});