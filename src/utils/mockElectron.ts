if (typeof window !== 'undefined' && !(window as any).electron) {
  console.warn('Electron context not found. Injecting browser mock for E2E testing.');
  
  // In-memory mock DB
const mockProducts = [
    {
        "id": "fam-incakola-orig",
        "codigoBarras": null,
        "nombre": "Inca Kola Sabor Original",
        "descripcion": "Gaseosa peruana dorada sabor original con gas refrescante en botella para compartir",
        "categoria": "Bebidas",
        "precio": 0,
        "costo": null,
        "stock": 0,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FBEB-W5IW.webp?alt=media&token=d3a160f5-03c4-4c19-9356-74350eaf8894",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": true,
        "etiquetas": ["gaseosa", "bebida", "refresco", "dorada"],
        "esPrincipalWeb": true,
        "mostrarPrecioWeb": true
    },
    {
        "id": "prod-incakola-500ml",
        "codigoBarras": "7750106001014",
        "nombre": "Inca Kola 500ml Pet",
        "descripcion": "Inca kola 500ml botella personal descartable",
        "categoria": "Bebidas",
        "precio": 3.0,
        "costo": 2.2,
        "stock": 35,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FBEB-W5IW.webp?alt=media&token=d3a160f5-03c4-4c19-9356-74350eaf8894",
        "thumbnailUrl": null,
        "disponible": false,
        "destacado": false,
        "etiquetas": [],
        "esPrincipalWeb": false,
        "productoPadreId": "fam-incakola-orig",
        "etiquetaVariante": "500ml Personal"
    },
    {
        "id": "prod-incakola-1500ml",
        "codigoBarras": "7750106001021",
        "nombre": "Inca Kola 1.5L Familiar",
        "descripcion": "Inca kola 1.5 litros botella mediana descartable",
        "categoria": "Bebidas",
        "precio": 7.5,
        "costo": 5.8,
        "stock": 20,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FBEB-W5IW.webp?alt=media&token=d3a160f5-03c4-4c19-9356-74350eaf8894",
        "thumbnailUrl": null,
        "disponible": false,
        "destacado": false,
        "etiquetas": [],
        "esPrincipalWeb": false,
        "productoPadreId": "fam-incakola-orig",
        "etiquetaVariante": "1.5L Familiar"
    },
    {
        "id": "ac0e9cd6-24ca-4454-be5f-9e5d8b3f6612",
        "codigoBarras": null,
        "nombre": "Aceituna Entera",
        "descripcion": "Aceitunas enteras frescas alimento a granel o por peso de consumo directo",
        "categoria": "Abarrotes",
        "precio": 15,
        "costo": 14,
        "stock": 5,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-0ZVP.webp?alt=media&token=1f8c1c07-7bba-425c-8c77-9fbafaf570f6",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "c8805fcb-b3a4-4445-aa8d-979bcd0a6fcd",
        "codigoBarras": null,
        "nombre": "Arveja Fresca",
        "descripcion": "Hortaliza legumbre fresca para cocina por peso a granel",
        "categoria": "Verduras",
        "precio": 8,
        "costo": 6,
        "stock": 10,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FVER-QH5P.webp?alt=media&token=07fc2e71-7c2b-43a6-9d7a-9316a980dff3",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "33453c18-eb8e-45ef-9643-4d09862ca81e",
        "codigoBarras": null,
        "nombre": "Azúcar Rubia",
        "descripcion": "Azúcar granulada endulzante alimento básico de cocina a granel",
        "categoria": "Abarrotes",
        "precio": 4,
        "costo": 3.8,
        "stock": 49,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-EF6S.webp?alt=media&token=92c0ad7f-0688-4a84-8b26-c0a5a7ac5268",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "f037ef27-402c-4e8c-8bb6-9eedc353b7c2",
        "codigoBarras": null,
        "nombre": "Casino Galletas Rellenas 43g",
        "descripcion": "Galleta dulce rellena aperitivo snack empaque individual bolsa",
        "categoria": "Golosinas",
        "precio": 1,
        "costo": 0.8,
        "stock": 50,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FGOL-Q065.webp?alt=media&token=6293d884-b220-43b6-8ec6-5f9b4f6c4519",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "0b6a458b-90d9-4cee-b511-4872049ce71a",
        "codigoBarras": null,
        "nombre": "Cebolla",
        "descripcion": "Hortaliza verdura fresca aderezo cocina a granel",
        "categoria": "Verduras",
        "precio": 1.5,
        "costo": 1.2,
        "stock": 0,
        "unidadMedida": "Kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FVER-URFB_1785450679935.webp?alt=media&token=f76b0aad-bc8e-4016-8898-d60b206ca8e9",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "51d861b5-a23c-4509-b1ad-d56401408081",
        "codigoBarras": null,
        "nombre": "Cielo Agua de Mesa 625ml",
        "descripcion": "Agua de mesa embotellada hidratación personal botella PET consumo frío",
        "categoria": "Bebidas",
        "precio": 1.2,
        "costo": 1,
        "stock": 49,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FBEB-W5IW.webp?alt=media&token=d3a160f5-03c4-4c19-9356-74350eaf8894",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "a6978dd8-1725-4ef8-aab9-17b4b759882f",
        "codigoBarras": null,
        "nombre": "Cinta Aislante Negra",
        "descripcion": "Cinta de PVC de alta resistencia y flexibilidad, diseñada para el aislamiento seguro de cables y empalmes eléctricos.",
        "categoria": "Ferreteria y electricidad",
        "precio": 2.4,
        "costo": 1.5,
        "stock": 93,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FFER-496J.webp?alt=media&token=81eefe62-7b8a-431c-877c-5609f572354d",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "065d6194-13d1-4811-ac2a-2cb53b1ddb1a",
        "codigoBarras": null,
        "nombre": "Clorox Lejía 319ml",
        "descripcion": "Lejía desinfectante blanqueador limpiador líquido para ropa y superficies botella plástica",
        "categoria": "Aseo y limpieza",
        "precio": 2,
        "costo": 1.2,
        "stock": 19,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FASE-CZWS.webp?alt=media&token=96a8b782-2fe7-442a-9517-1c96fbac6625",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "25398f6e-4921-491c-9d51-38a3ca370055",
        "codigoBarras": null,
        "nombre": "Don Vittorio Fideos Pasta Largo 500g",
        "descripcion": "Fideos pasta de trigo alimento básico de cocina bolsa plástica",
        "categoria": "Abarrotes",
        "precio": 5,
        "costo": 4,
        "stock": 6,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-7LS5.webp?alt=media&token=199fae9b-bcdb-4a38-bbb3-ac6210fc78b4",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "45f526d9-835f-4d07-a368-823652cae1e8",
        "codigoBarras": null,
        "nombre": "Espinaca Fresca",
        "descripcion": "Espinaca fresca hortaliza verdura de hoja verde para ensaladas y cocina a granel",
        "categoria": "Verduras",
        "precio": 3,
        "costo": 2,
        "stock": 3,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FVER-BB65.webp?alt=media&token=dc3e96f7-3fff-44b8-8488-2f6edcc84290",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "5e0f71c2-860f-43ee-970c-b4d6eef038a1",
        "codigoBarras": null,
        "nombre": "Faraón Arroz Blanco Extra",
        "descripcion": "Arroz blanco cereal grano entero alimento básico de cocina bolsa",
        "categoria": "Abarrotes",
        "precio": 4.8,
        "costo": 4.2,
        "stock": 50,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-Z1IN.webp?alt=media&token=23847785-b885-4dda-bdde-16cc79b16fba",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "febojkam9",
        "codigoBarras": null,
        "nombre": "Fideos San Jorge 250gr",
        "descripcion": "¡El aliado perfecto para tus caldos!",
        "categoria": "Abarrotes",
        "precio": 2.2,
        "costo": 1.5,
        "stock": 44,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-F4F4.webp?alt=media&token=2ef8e670-731d-42af-bc1a-5fc56c88b6e7",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "d251e32b-46f4-45f9-8d83-14676a56b509",
        "codigoBarras": null,
        "nombre": "Gloria Yogurt Frutado 946g",
        "descripcion": "Yogur bebible lácteo alimento para desayuno botella plástica refrigerado",
        "categoria": "Abarrotes",
        "precio": 7,
        "costo": 5,
        "stock": 10,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-2MOH.webp?alt=media&token=c4b79800-1744-40c4-a8ed-c6c3ced1dab8",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "a388135e-0ba7-4671-a316-778c6f3b3977",
        "codigoBarras": null,
        "nombre": "Harina de Trigo",
        "descripcion": "Harina molida cereal insumo de panadería y repostería alimento básico a granel",
        "categoria": "Abarrotes",
        "precio": 3,
        "costo": 2,
        "stock": 10,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-RGU9.webp?alt=media&token=89c1ae3a-358c-4fa3-8e18-f8a330105746",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "b53f19cd-fe99-496c-9a30-47fadc5fb517",
        "codigoBarras": null,
        "nombre": "Huevo de Gallina",
        "descripcion": "Huevos frescos de gallina alimento básico proteína consumo masivo a granel",
        "categoria": "Abarrotes",
        "precio": 6.8,
        "costo": 6,
        "stock": 20,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-BFOK.webp?alt=media&token=e2fee108-0c10-4730-89a3-1ff8c6437c66",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "213c8d76-ede6-4e16-9269-c6394058f410",
        "codigoBarras": null,
        "nombre": "Inca Kola Gaseosa 500ml",
        "descripcion": "Bebida gaseosa refresco carbonatado botella PET consumo frío",
        "categoria": "Bebidas",
        "precio": 3.5,
        "costo": 3,
        "stock": 23,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FBEB-QSA5.webp?alt=media&token=8b7ec75c-7429-4819-9248-f387e259f093",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "74f4af0d-aaeb-4dce-802c-2570fb1ccae9",
        "codigoBarras": null,
        "nombre": "Laurel y Hongo",
        "descripcion": "Condimento especias secas insumo para aderezos y cocina empaque transparente bolsa",
        "categoria": "Abarrotes",
        "precio": 1,
        "costo": 0.8,
        "stock": 20,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-A2MW.webp?alt=media&token=12456c2d-8bf0-45ae-bb2e-3a7450e33d36",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "qv44xrwg3",
        "codigoBarras": null,
        "nombre": "Leche Gloria Azul 390gr",
        "descripcion": "Leche evaporada reconstituida y enriquecida con vitaminas A y D.",
        "categoria": "Abarrotes",
        "precio": 2.6,
        "costo": 3.2,
        "stock": 83,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-W7R3.webp?alt=media&token=5375a353-4427-4c8f-bef8-70c2cb1243b6",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": true,
        "etiquetas": []
    },
    {
        "id": "9c26fd91-4d64-4dc6-90a2-ae6eb67cbe3f",
        "codigoBarras": null,
        "nombre": "Lenteja bebe",
        "descripcion": "Legumbre seca menestra granos enteros alimento básico de cocina a granel",
        "categoria": "Abarrotes",
        "precio": 8,
        "costo": 6,
        "stock": 10,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-DJW1.webp?alt=media&token=605198ce-f024-4d3a-95fd-77fc79e38867",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "2f62b146-69ee-4342-b538-09c7bea95b26",
        "codigoBarras": null,
        "nombre": "Menú Almuerzo",
        "descripcion": "Comida preparada plato de fondo almuerzo menú diario consumo inmediato",
        "categoria": "Ocasión y Otros",
        "precio": 10,
        "costo": 7,
        "stock": 9,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FOCA-WKMF.webp?alt=media&token=1640c4c4-0786-4796-882b-57c995616146",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": true,
        "etiquetas": []
    },
    {
        "id": "a0f63d13-4620-41bf-b08b-4d7619f5c757",
        "codigoBarras": null,
        "nombre": "Nestlé Lentejas Grageas Confitadas 16g",
        "descripcion": "Golosina snack dulce grageas confitadas bolsa empaque individual",
        "categoria": "Golosinas",
        "precio": 1,
        "costo": 0.8,
        "stock": 20,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FGOL-6HS9.webp?alt=media&token=baf755f3-746f-46ba-a7a5-ca5a4e5c8fea",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "e50b23f8-74e3-4e05-b5c7-55accccd1f60",
        "codigoBarras": null,
        "nombre": "Nestlé Morochas Taco Galletas 75g",
        "descripcion": "Galletas dulce aperitivo snack",
        "categoria": "Golosinas",
        "precio": 3,
        "costo": 2.1,
        "stock": 0,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FGOL-2AQ5.webp?alt=media&token=762b132c-0cfc-4ca7-98e3-46883dbe8266",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "9c9e32c3-e068-46ca-926b-c77956ead400",
        "codigoBarras": null,
        "nombre": "Nestlé Sublime Chocolate 37g",
        "descripcion": "Golosina snack dulce tableta de chocolate empaque individual",
        "categoria": "Golosinas",
        "precio": 3.2,
        "costo": 2.5,
        "stock": 29,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FGOL-CD58.webp?alt=media&token=e96f566a-f2a3-40d6-92e5-ccd7546c1fa8",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "275c1e15-acf3-4815-ae44-84756c092021",
        "codigoBarras": null,
        "nombre": "Pan Francés",
        "descripcion": "Pan fresco de panadería panificación consumo diario",
        "categoria": "Ocasión y Otros",
        "precio": 1,
        "costo": 0.8,
        "stock": 99,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FOCA-SAKL.webp?alt=media&token=f6bd4af3-da58-434e-919b-f3a5cc5ed07f",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": true,
        "etiquetas": []
    },
    {
        "id": "8264a81e-d95c-47d0-bae7-a8718d7134cf",
        "codigoBarras": null,
        "nombre": "Papa Blanca",
        "descripcion": "Tubérculo fresco vegetal para cocina consumo diario",
        "categoria": "Verduras",
        "precio": 1.5,
        "costo": 1,
        "stock": 20,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-B8RQ.webp?alt=media&token=afd0b9c3-0a82-4454-a725-02c395ff2d01",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "80a1c360-eed4-4cb4-813f-19b3ee25f46c",
        "codigoBarras": null,
        "nombre": "Pera",
        "descripcion": "Fruta fresca natural consumo directo alimento saludable",
        "categoria": "Frutas",
        "precio": 5,
        "costo": 4,
        "stock": 52,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FFRU-LT96.webp?alt=media&token=af3ea287-963f-4bb5-a411-05523e09a5b3",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "d25d6019-122f-43f6-a87e-1ecb54d45e71",
        "codigoBarras": null,
        "nombre": "Plátano de Seda",
        "descripcion": "Fruta tropical dulce y cremosa, perfecta para un snack nutritivo o para incluir en jugos y postres.",
        "categoria": "Frutas",
        "precio": 2.5,
        "costo": 2,
        "stock": 65,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FFRU-R6NX.webp?alt=media&token=5d8070ce-e498-4310-ae66-1cb95858f934",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "05274deb-f25b-43e9-a487-8b6d977bd3f3",
        "codigoBarras": null,
        "nombre": "Pollo",
        "descripcion": "Pollo fresco entero carne de ave proteína alimento para cocina a granel",
        "categoria": "Abarrotes",
        "precio": 9.8,
        "costo": 6,
        "stock": 5,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-AHCS.webp?alt=media&token=eb77b088-2d74-4c58-8faf-7994f0efbee0",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "d6fa2e00-1e31-4f46-ab1d-f5f1b6ce0006",
        "codigoBarras": null,
        "nombre": "Queso Fresco",
        "descripcion": "Queso fresco lácteo derivado lácteo alimento para consumo por peso o entero",
        "categoria": "Abarrotes",
        "precio": 18,
        "costo": 16,
        "stock": 5,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-U14B.webp?alt=media&token=8fef0b5b-b663-4787-9e15-5276b798cacb",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "417f181b-8e14-4e20-8861-88c48d0aa7d6",
        "codigoBarras": null,
        "nombre": "Sal de Mar 1kg",
        "descripcion": "Sal de mesa marina sazonador condimento de cocina bolsa",
        "categoria": "Abarrotes",
        "precio": 1.6,
        "costo": 1.2,
        "stock": 20,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-E4VE_1785450703693.webp?alt=media&token=fec0a193-83f1-4b18-8615-e7a1edeeccae",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "c6af97ff-63a9-4486-a475-d93d6b183888",
        "codigoBarras": null,
        "nombre": "Sopa Caldo de Carnero",
        "descripcion": "Caldo tradicional preparado plato servido consumo directo",
        "categoria": "Ocasión y Otros",
        "precio": 12,
        "costo": 10,
        "stock": 20,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FABA-8399.webp?alt=media&token=37bc3247-4c94-42a5-82bf-61c5b55b6f83",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "0aa8cc8b-e7a2-4e7e-9598-d6ca070e04ca",
        "codigoBarras": null,
        "nombre": "Sopa Patasca",
        "descripcion": "Caldo tradicional preparado plato servido consumo directo",
        "categoria": "Ocasión y Otros",
        "precio": 8,
        "costo": 6,
        "stock": 20,
        "unidadMedida": "unidad",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FOCA-SK94.webp?alt=media&token=964ceeda-5adf-4216-9ccd-0daa104e8bf5",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "0e8969c7-ac62-4299-bd09-16d287361131",
        "codigoBarras": null,
        "nombre": "Tomate",
        "descripcion": "Tomate fresco hortaliza verdura para ensaladas y cocina a granel",
        "categoria": "Verduras",
        "precio": 3.5,
        "costo": 3,
        "stock": 6,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FVER-G9Z9.webp?alt=media&token=f9d0dcfc-985a-4d60-875d-be6129a125c0",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "3851ec42-81e7-46d8-85b4-9cb476a5b20e",
        "codigoBarras": null,
        "nombre": "Zanahoria Fresca",
        "descripcion": "Zanahoria hortaliza verdura raíz comestible para ensaladas y cocina a granel",
        "categoria": "Verduras",
        "precio": 2,
        "costo": 1.2,
        "stock": 5,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FVER-KTQM.webp?alt=media&token=d8848ef6-ae0c-4250-84f4-0284d69cc859",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    },
    {
        "id": "c3fc521f-548f-4989-b8ca-0d32bcc8cda6",
        "codigoBarras": null,
        "nombre": "Zapallo Macre",
        "descripcion": "Zapallo fresco hortaliza verdura para cocina por peso o entero a granel",
        "categoria": "Verduras",
        "precio": 2.5,
        "costo": 2,
        "stock": 20,
        "unidadMedida": "kg",
        "imagenUrl": "https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/productos%2FVER-60MK.webp?alt=media&token=cf8c7910-1dae-4bd0-8bcf-8630dc5f4da4",
        "thumbnailUrl": null,
        "disponible": true,
        "destacado": false,
        "etiquetas": []
    }
];

  const mockUsers = [
    { id: 'VPxI3QIBbTXsBsHPdPCWmTNW9ig1', username: 'Erick Martinez', email: 'erickmartinezc@gmail.com', role: 'admin', permisos: ['all'], activo: true },
    { id: 'UYNvCVk2wkg0pfWtQiRkxeVUa742', username: 'Flor', email: 'flor@gmail.com', role: 'colaborador', permisos: ['inventario:consultar', 'compras:gestionar'], activo: true },
    { id: 'U0xamKIHgJVUudGGPYbHP851fu02', username: 'Rosario', email: 'rosario@gmail.com', role: 'colaborador', permisos: ['inventario:consultar', 'compras:gestionar'], activo: true },
    { id: 'admin-id', username: 'admin', email: 'admin@minimarket.com', role: 'admin', permisos: ['all'], activo: true },
    { id: 'colab-id', username: 'cajero', email: 'cajero@minimarket.com', role: 'colaborador', permisos: ['ventas:cobrar', 'ventas:historial'], activo: true }
  ];

  const mockWebConfig = {
    general: {
      nombreTienda: 'Minimarket Flor',
      descripcionTienda: 'Minimarket dedicado a la venta de abarrotes y productos de consumo diario. Ofrecemos una amplia selección de alimentos, bebidas, artículos de cuidado personal, limpieza y productos de primera necesidad.',
      whatsapp: '51997346193',
      emailContacto: 'erickmartinezc@gmail.com',
      ubicacion: 'El Bosque Mz. G Lote 6, Lurigancho-Chosica, Lima 15468',
      horarioAtencion: 'Lunes a Sábado: 8:00 AM - 9:00 PM\nDomingo: 7:00 AM - 7:00 PM',
      mostrarPrecios: false
    },
    empresa: {
      ruc: '20608754123',
      razonSocial: 'Minimarket Flor S.A.C.',
      nombreComercial: 'Minimarket Flor',
      direccionFiscal: 'El Bosque Mz. G Lote 6, Lurigancho-Chosica, Lima 15468',
      telefono: '51997346193',
      leyenda: 'Representación impresa de la Boleta de Venta Electrónica. ¡Gracias por su preferencia!'
    },
    comunidad: {
      avisoGlobal: '',
      telefonos: [
        { id: '1', nombre: 'Serenazgo Lurigancho', numero: '01 360-3000' },
        { id: '2', nombre: 'Bomberos Chosica', numero: '116' }
      ],
      anuncios: [
        { id: '1', nombre: 'Gas Express Flor', descripcion: 'Reparto de balones de gas a domicilio', telefono: '997346193' }
      ],
      avisos: [
        { id: '1', titulo: 'Horario Especial Fin de Semana', contenido: 'Atención continuada de 7:00 AM a 9:00 PM.', fecha: '17/08/2026' }
      ]
    },
    ia: {
      iaBusquedaHabilitada: true,
      iaCombosHabilitada: false,
      ultimaModificacion: '2026-07-28T22:26:40.935Z'
    }
  };

  const mockBanners = [
    {
      id: '5f7be549-6494-4623-8210-64bd717543e2',
      title: '',
      subtitle: '',
      imageUrl: 'https://firebasestorage.googleapis.com/v0/b/minimarket-flor-8d7f9.firebasestorage.app/o/banners%2FGEN-UTJD_1785446263287.webp?alt=media&token=544a5faa-4614-4acd-87e6-57b19cde0a68',
      badgeText: '',
      ctaText: 'Ver más',
      ctaActionCategory: 'Ocasión y Otros',
      active: true,
      priority: 1
    }
  ];

  const mockVentas = [
    { id: 'TKT-0001', total: 21.80, subtotal: 18.47, igv: 3.33, descuento: 0, fecha: '2026-07-12 10:24:15', metodoPago: 'Efectivo', clienteDni: '12345678', clienteNombre: 'Juan Pérez', estado: 'completada', detalles: [{ producto_nombre: 'Aceite Primor Premium 1L', cantidad: 1, precioUnitario: 11.50, subtotal: 11.50 }, { producto_nombre: 'Arroz Integral Costeño 1kg', cantidad: 2, precioUnitario: 4.80, subtotal: 9.60 }] }
  ];

  const mockListas = [
    { id: 'L-001', titulo: 'Pedido de Abarrotes del Lunes', costoAproximado: 250.00, itemsCount: 4, fecha: '12/07/2026 15:30', estado: 'completada', detalles_json: JSON.stringify([{ id: '1', nombre: 'Arroz Integral Costeño 1kg', cantidad: 50 }, { id: '2', nombre: 'Aceite Primor Premium 1L', cantidad: 10 }]) }
  ];

  (window as any).electron = {
    openExternal: async (url: string) => console.log('Mock openExternal:', url),
    buscarProductoPorCodigo: async (codigo: string) => mockProducts.find(p => p.codigoBarras === codigo && !p.esPrincipalWeb) || null,
    buscarProductosPorNombre: async (nombre: string) => mockProducts.filter(p => !p.esPrincipalWeb && (p.nombre.toLowerCase().includes(nombre.toLowerCase()) || (p.descripcion && p.descripcion.toLowerCase().includes(nombre.toLowerCase())))),
    obtenerTodosProductos: async () => mockProducts,
    obtenerProductosParaVenta: async () => mockProducts.filter(p => !p.esPrincipalWeb && p.disponible !== false),
    obtenerPresentacionesDeFamilia: async (familiaId: string) => mockProducts.filter(p => p.productoPadreId === familiaId),
    guardarFamiliaConPresentaciones: async ({ familia, presentaciones }: { familia: any; presentaciones: any[] }) => {
      const familiaId = familia.id || `fam-${Date.now()}`;
      const productoFamilia = {
        ...familia,
        id: familiaId,
        codigoBarras: null,
        esPrincipalWeb: true,
        precio: Number(familia.precio || 0),
        stock: Number(familia.stock || 0),
        disponible: familia.disponible !== false,
        mostrarPrecioWeb: Boolean(familia.mostrarPrecioWeb)
      };

      const existingIdx = mockProducts.findIndex(p => p.id === familiaId);
      if (existingIdx !== -1) {
        mockProducts[existingIdx] = { ...mockProducts[existingIdx], ...productoFamilia };
      } else {
        mockProducts.push(productoFamilia);
      }

      // Desvincular anteriores
      const nuevosIds = new Set((presentaciones || []).map(p => p.id));
      mockProducts.forEach(p => {
        if (p.productoPadreId === familiaId && !nuevosIds.has(p.id)) {
          p.productoPadreId = undefined;
          p.etiquetaVariante = undefined;
        }
      });

      // Vincular nuevas presentaciones
      (presentaciones || []).forEach(pres => {
        const prod = mockProducts.find(p => p.id === pres.id);
        if (prod && prod.id !== familiaId) {
          prod.productoPadreId = familiaId;
          prod.etiquetaVariante = pres.etiquetaVariante || '';
        }
      });

      return { success: true, id: familiaId };
    },
    crearProducto: async (p: any) => { mockProducts.push(p); return { success: true, id: p.id || `prod-${Date.now()}` }; },
    actualizarProducto: async (p: any) => {
      const idx = mockProducts.findIndex(x => x.id === p.id);
      if (idx !== -1) mockProducts[idx] = { ...mockProducts[idx], ...p };
      return { success: true };
    },
    eliminarProducto: async (id: string) => {
      // Si era familia, desvincular hijos
      mockProducts.forEach(p => {
        if (p.productoPadreId === id) {
          (p as any).productoPadreId = undefined;
          (p as any).etiquetaVariante = undefined;
        }
      });
      const idx = mockProducts.findIndex(x => x.id === id);
      if (idx !== -1) mockProducts.splice(idx, 1);
      return { success: true };
    },
    guardarVenta: async (venta: any, detalle: any) => {
      mockVentas.unshift({ ...venta, detalles: detalle });
      return { success: true, ticketId: venta.id };
    },
    obtenerVentas: async (filtros: any) => {
      let filtered = [...mockVentas];
      if (filtros?.ticketId) filtered = filtered.filter(v => v.id.includes(filtros.ticketId));
      if (filtros?.metodoPago && filtros.metodoPago !== 'TODOS') filtered = filtered.filter(v => v.metodoPago === filtros.metodoPago);
      return filtered;
    },
    login: async (username: string, _pass: string) => {
      const term = (username || '').trim().toLowerCase();
      const u = mockUsers.find(x => x.username.toLowerCase() === term || (x.email && x.email.toLowerCase() === term) || x.id === username);
      if (u) return { success: true, user: u };
      return { success: false, error: 'Usuario o correo incorrecto' };
    },
    obtenerUsuarios: async () => mockUsers,
    crearUsuario: async (data: any) => { mockUsers.push(data.userData); return { success: true }; },
    actualizarUsuario: async (data: any) => {
      const idx = mockUsers.findIndex(x => x.id === data.userData.id);
      if (idx !== -1) mockUsers[idx] = { ...mockUsers[idx], ...data.userData };
      return { success: true };
    },
    eliminarUsuario: async (id: string) => {
      const idx = mockUsers.findIndex(x => x.id === id);
      if (idx !== -1) mockUsers.splice(idx, 1);
      return { success: true };
    },
    procesarImagenLocal: async () => ({ success: true, base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }),
    imprimirSilencioso: async () => ({ success: true }),
    getFirebaseConfig: async () => ({
      apiKey: "mock-api-key",
      authDomain: "mock-domain.firebaseapp.com",
      projectId: "mock-project",
      storageBucket: "mock-bucket.appspot.com",
      appId: "1:mock:web:app"
    }),
    setFirebaseConfig: async () => ({ success: true }),
    descargarDatosDesdeNube: async () => ({ success: true }),
    startManualSync: async () => ({ success: true }),
    forzarSincronizacion: async () => ({ success: true }),
    obtenerEstadoSync: async () => ({ success: true, pendingCount: 0 }),
    onSyncCompleted: () => () => {},
    onSyncError: () => () => {},
    onSyncStatus: () => () => {},
    obtenerWebConfig: async () => ({ success: true, config: mockWebConfig }),
    guardarWebConfig: async (key: string, value: any) => {
      (mockWebConfig as any)[key] = value;
      return { success: true };
    },
    obtenerBanners: async () => ({ success: true, banners: mockBanners }),
    crearBanner: async (b: any) => { mockBanners.push(b); return { success: true }; },
    actualizarBanner: async (b: any) => {
      const idx = mockBanners.findIndex(x => x.id === b.id);
      if (idx !== -1) mockBanners[idx] = { ...mockBanners[idx], ...b };
      return { success: true };
    },
    eliminarBanner: async (id: string) => {
      const idx = mockBanners.findIndex(x => x.id === id);
      if (idx !== -1) mockBanners.splice(idx, 1);
      return { success: true };
    },
    obtenerDashboardData: async () => ({
      success: true,
      ventas: mockVentas,
      stock: mockProducts.filter(p => p.stock <= 10)
    }),
    guardarListaCompra: async (lista: any, detalles: any) => {
      mockListas.unshift({ ...lista, detalles_json: JSON.stringify(detalles) });
      return { success: true };
    },
    obtenerListasCompras: async () => mockListas,
    eliminarListaCompra: async (id: string) => {
      const idx = mockListas.findIndex(x => x.id === id);
      if (idx !== -1) mockListas.splice(idx, 1);
      return { success: true };
    }
  };
}
export {};
