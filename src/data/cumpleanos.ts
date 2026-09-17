/**
 * Fechas de nacimiento cargadas desde la base de Recursos Humanos (SPEC-017).
 *
 * Esta lista NO es la fuente de verdad: solo siembra el padrón la primera vez.
 * Al abrir Antigüedad y Vacantes, un administrador escribe en Firestore las
 * fechas de quien todavía no tiene ninguna, y a partir de ahí la fecha vive en
 * el padrón y se edita desde el Directorio como cualquier otro dato.
 *
 * Por eso la siembra solo rellena huecos y nunca pisa una fecha existente: si
 * alguien corrige aquí una fecha equivocada, esta lista no debe devolverla.
 *
 * Quedaron fuera a propósito dos registros de la base original:
 *   2251 Luis Gerardo Frías Bravo — venía 30-08-2022, que daría 4 años de edad
 *   2419 Sánchez López Octavio    — venía sin fecha
 * Ambos se capturan a mano desde el Directorio.
 */
export const CUMPLEANOS_INICIALES: Record<string, string> = {
  '20': '1973-10-07', // Claudia Alejandra Muñoz Maldonado
  '86': '1977-11-29', // Julia Margarita Pacheco Sotelo
  '109': '1974-06-29', // Pablo Pedro Sánchez Cortes
  '124': '1961-04-09', // Tomas San Juan Santes
  '176': '1975-08-24', // Maria trinidad Martinez Castro
  '263': '1969-09-10', // Nicolas Molina Reyes
  '329': '1974-02-18', // Felix Antonio Reyes
  '489': '1983-12-17', // Adrian Guadalupe Sosa Bautista
  '514': '1969-11-05', // Maria Josefa Morelos Guerrero
  '638': '1989-04-24', // Manuel Vidal Díaz
  '672': '1969-12-12', // Mota Saul X
  '736': '1985-07-02', // Eduardo Rios Moreno
  '768': '1980-07-31', // Gabriela Montes Flores
  '769': '1975-01-24', // Paula del Angel Hernández
  '810': '1969-12-24', // Angel Perez Zavaleta
  '812': '1970-01-20', // Norma Beatriz Cruz Sandoval
  '817': '1977-02-09', // Adriana Ayala Guzman
  '821': '1983-02-07', // Nicasio Rivera Rivera
  '841': '1981-11-28', // Rafael Martinez Guillen
  '852': '1979-11-07', // Marco Alberto De La Torre Jimenez
  '885': '1983-12-26', // Angel Gamaliel Magallanes López
  '1010': '1973-04-02', // Ana Maria Delgado Alvarez
  '1015': '1982-03-21', // Karla Villegas Morquecho
  '1049': '1989-11-23', // Francisco Javier Correa Miramontes
  '1113': '1988-10-02', // Angel Noe Orozco Macias
  '1114': '1990-09-28', // Viridiana Monserrat Rivera Jimenez
  '1227': '1988-09-03', // Angel Calderón Topete
  '1237': '1991-07-17', // Ricardo Cabrera Martinez
  '1320': '1971-01-05', // Ana Rosa Chavez Cibrian
  '1332': '1984-04-06', // Antonio De Jesus Montes de Oca Vela
  '1479': '1988-07-10', // Elizabeth Gónzalez López
  '1502': '1991-11-18', // Erick Roman Santiago Ticante
  '1504': '1977-08-20', // Bernardo Cervantes Díaz
  '1510': '1991-09-04', // Juan Pablo Cruz Hernández
  '1525': '1996-04-06', // Jose Juan Vega Trejo
  '1554': '1998-01-11', // Luis Manuel Gutierrez Cruz
  '1677': '1994-02-01', // Erika Castorena Gómez
  '1683': '1999-02-05', // Luis Francisco Serrano Gutierrez
  '1708': '1999-02-08', // Amalia Cruz Benigno
  '1781': '1986-05-28', // Karla Araceli Bautista Madrid
  '1802': '1989-05-06', // Candelario Nuñez Arellano
  '1815': '2000-01-17', // Nallely Karina Beltran Gonzalez
  '1824': '1997-10-20', // Sergio Arturo Morales Jimenez
  '1825': '1992-02-05', // Ruben de Jesus Navarro Castillo
  '1827': '1992-04-12', // Jose Ivan Gómez Jimenez
  '1853': '1983-06-21', // Rodolfo Julian Iglesias
  '1869': '2000-04-23', // Javier Santiago Ramos López
  '1896': '1983-03-02', // Alma Yadira Armenta Hernández
  '1911': '1995-06-11', // Francisco Avendaño Díaz
  '1919': '1992-12-27', // Cornelio Marcial Hernández
  '1959': '1996-12-07', // Daniel Zarate Monroy
  '1969': '1991-02-02', // Sandra Yoqueved Sánchez Flores
  '1972': '2001-04-07', // Diego Josue Tomas Zepeda
  '1980': '1999-08-24', // Fatima Guadalupe Corona Jimenez
  '1983': '1975-10-01', // Janette Georgina Campos Huerta
  '2014': '1986-10-22', // Pedro Guadalupe Arteaga Santos
  '2034': '1998-06-26', // Rosa García Vázquez
  '2047': '1976-08-04', // Enrique Sándoval Martínez
  '2058': '1986-10-27', // Víctor Moreno García
  '2068': '1996-02-12', // Daniel Cardenas Perez
  '2078': '1997-10-14', // Vianney Montserrat Camacho Guerrero
  '2091': '1985-08-18', // Ramón Valencia Reyes
  '2097': '1999-12-06', // Maricela Prisciliano Jimenez
  '2117': '2002-01-27', // Alvaro Isaias Castro Castañeda
  '2129': '1997-06-24', // Aldo Yael Estrada Rodriguez
  '2133': '1986-10-22', // AVALOS GALINDO OSCAR ULISES
  '2152': '1993-12-15', // Victor Manuel Andrade Gutierrez
  '2155': '1993-09-23', // Caren Isela Esparza López
  '2159': '1973-04-21', // SOTO MENESES OSCAR
  '2188': '1992-06-11', // Maria Rosalina Lugardo Altamirano
  '2196': '1989-02-12', // Mario Alberto Curiel Hernández
  '2212': '1980-10-01', // Omar Alejandro Franco Contreras
  '2216': '2001-02-10', // Jessica Guadalupe Díaz De León
  '2223': '1991-05-30', // Aurora Estephany Jimenez López
  '2224': '1969-07-25', // Fernando Tello Jasso
  '2258': '1988-02-09', // Rufino Morales Morales
  '2267': '1980-05-16', // Ana Rosa Moran Ramos
  '2272': '1984-09-30', // Miguel Angel Gonzalez Tellez
  '2283': '1992-12-10', // Maritza Galván Rivas
  '2285': '1994-06-13', // Francisco Javier García Elvira
  '2292': '1996-07-03', // Mauricio Armando Paez Santos
  '2305': '1994-05-15', // Ana Delia Luna Aranda
  '2308': '1998-06-17', // Sergio Castruita Cruz
  '2339': '1995-07-04', // Luis Fernando Luna García
  '2347': '1983-02-03', // Rosa Bejar Robles
  '2354': '2004-10-04', // Paola Alejandra Rodriguez Martinez
  '2357': '1996-02-19', // Cristian Ruben Gonzalez Morales
  '2366': '1991-12-19', // Aldher Eduardo Vargas Reyes
  '2369': '1999-10-16', // Brenda Aguilar Salinas
  '2377': '1982-11-29', // Jose David Avalos Monreal
  '2383': '1973-09-23', // Elbia Monrroy Everastico
  '2389': '1998-06-20', // Silvia García Gallardo
  '2392': '1982-06-11', // Jesus Cadena Barbosa
  '2393': '2002-01-02', // Cristoper Moises Gonzalez Martinez
  '2395': '1997-03-01', // Luis Roberto Perez Huerta
  '2396': '1997-09-05', // Tania Sarahí Huerta Jacquez
  '2398': '1982-09-08', // Samuel Zarate Monroy
  '2399': '1986-12-04', // Agustina Gonzalez Martinez
  '2407': '1987-08-24', // Luz Elena Villanueva Martinez
  '2413': '1977-07-13', // Porfiria Esther Sánchez Vázquez
  '2414': '2001-12-31', // Daniel Cortes Altamirano
  '2428': '1996-09-15', // Ricardo Pioquinto Cabrera
  '2430': '1995-08-24', // RAUL HERNANDEZ SANTIAGO
  '2431': '1991-05-15', // JASBAD JOSE DE JESUS URIBE AGUSTIN
  '2432': '2001-12-05', // EMMANUEL TEJEDA CAMPOS
  '2433': '2004-10-12', // EDUARDO MARGARITO TORRES GUZMAN
  '2434': '2005-06-12', // CARLOS HUERTA SANTIAGO
  '2435': '2000-07-22', // JOSELYNE MAGDALENA MENDOZA PARRA
  '2436': '1999-07-28', // ANDREA JAQUELIN MADERO ACOSTA
  '2437': '2005-02-17', // JONATHAN RODRIGUEZ SANCHEZ
  '2440': '2000-07-19', // RODRIGUEZ VICENTE ERIKA
  '2443': '2003-11-20', // LOPEZ OLIVERA MARIA GUADALUPE
  '2449': '1987-11-04', // ALEMAN BALTAZAR MARTIN
};
