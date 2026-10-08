-- ============================================================================
-- LIMPIEZA: filas duplicadas en tipologia_filas + causa raíz
-- Ejecutar en el SQL Editor de Supabase. Ejecuta los pasos EN ORDEN.
-- ============================================================================

-- PASO 1 — Causa raíz.
-- El registro de material (orden_perfiles_uso) apuntaba a tipologia_filas sin
-- permitir borrarlas. Al guardar una tipología (que borra y recrea sus filas)
-- el borrado fallaba y las filas nuevas se añadían a las viejas.
-- Con "on delete set null" el registro conserva el corte y solo pierde el vínculo.
alter table orden_perfiles_uso
  drop constraint if exists orden_perfiles_uso_tipologia_fila_id_fkey;
alter table orden_perfiles_uso
  add constraint orden_perfiles_uso_tipologia_fila_id_fkey
  foreign key (tipologia_fila_id) references tipologia_filas(id) on delete set null;

-- PASO 2 — (solo mirar) filas que se van a borrar: las sobrantes de cada posición.
-- Se conserva, por posición, la fila que tiene código de catálogo y, si hay
-- empate, la más reciente.
select f.tipologia_id, t.nombre, f.posicion, f.tipo, f.nombre_perfil, f.formula,
       f.catalogo_perfil_id, f.id,
       row_number() over (partition by f.tipologia_id, f.posicion
                          order by (f.catalogo_perfil_id is not null) desc, f.id desc) as orden
from tipologia_filas f join tipologias t on t.id = f.tipologia_id
order by t.nombre, f.posicion, orden;
-- (las filas con orden = 1 se quedan; las de orden > 1 se borran en el paso 3)

-- PASO 3 — borrar las sobrantes.
delete from tipologia_filas
where id in (
  select id from (
    select id,
           row_number() over (partition by tipologia_id, posicion
                              order by (catalogo_perfil_id is not null) desc, id desc) as rn
    from tipologia_filas
  ) x
  where rn > 1
);

-- PASO 4 — que no pueda volver a pasar: una sola fila por posición.
create unique index if not exists ux_tipologia_filas_posicion
  on tipologia_filas (tipologia_id, posicion);

-- PASO 5 — comprobación: "filas" debe ser igual a "posiciones_distintas" en todas.
select t.id, t.nombre, count(f.id) as filas, count(distinct f.posicion) as posiciones_distintas
from tipologias t left join tipologia_filas f on f.tipologia_id = t.id
group by t.id, t.nombre order by t.nombre;
