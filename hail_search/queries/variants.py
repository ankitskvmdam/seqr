import hail as hl

from hail_search.constants import ABSENT_PATH_SORT_OFFSET, CLINVAR_KEY, CLINVAR_LIKELY_PATH_FILTER, CLINVAR_PATH_FILTER, \
    CLINVAR_PATH_RANGES, CLINVAR_PATH_SIGNIFICANCES, HAS_ALLOWED_SECONDARY_ANNOTATION, HGMD_KEY, HGMD_PATH_RANGES, \
    GNOMAD_GENOMES_FIELD, PREFILTER_FREQ_CUTOFF, PATH_FREQ_OVERRIDE_CUTOFF, PATHOGENICTY_SORT_KEY, PATHOGENICTY_HGMD_SORT_KEY, \
    SCREEN_KEY, SPLICE_AI_FIELD, VARIANT_DATASET, CONSEQUENCE_SORT
from hail_search.queries.base import BaseHailTableQuery, PredictionPath, QualityFilterFormat


class VariantHailTableQuery(BaseHailTableQuery):

    DATA_TYPE = VARIANT_DATASET

    TRANSCRIPTS_FIELD = 'sorted_transcript_consequences'
    TRANSCRIPT_CONSEQUENCE_FIELD = 'consequence_term'
    GENOTYPE_FIELDS = {f.lower(): f for f in ['DP', 'GQ', 'AB']}
    QUALITY_FILTER_FORMAT = {
        'AB': QualityFilterFormat(override=lambda gt: ~gt.GT.is_het(), scale=100),
    }
    POPULATIONS = {
        'seqr': {'hom': 'hom', 'hemi': None, 'het': None, 'sort': 'callset_af'},
        'topmed': {'hemi': None},
        'exac': {
            'filter_af': 'AF_POPMAX', 'ac': 'AC_Adj', 'an': 'AN_Adj', 'hom': 'AC_Hom', 'hemi': 'AC_Hemi',
            'het': 'AC_Het',
        },
        'gnomad_exomes': {'filter_af': 'AF_POPMAX_OR_GLOBAL', 'het': None, 'sort': 'gnomad_exomes'},
        GNOMAD_GENOMES_FIELD: {'filter_af': 'AF_POPMAX_OR_GLOBAL', 'het': None, 'sort': 'gnomad'},
    }
    POPULATION_FIELDS = {'seqr': 'gt_stats'}
    PREDICTION_FIELDS_CONFIG = {
        'cadd': PredictionPath('cadd', 'PHRED'),
        'eigen': PredictionPath('eigen', 'Eigen_phred'),
        'fathmm': PredictionPath('dbnsfp', 'fathmm_MKL_coding_pred'),
        'gnomad_noncoding': PredictionPath('gnomad_non_coding_constraint', 'z_score'),
        'mpc': PredictionPath('mpc', 'MPC'),
        'mut_pred': PredictionPath('dbnsfp', 'MutPred_score'),
        'primate_ai': PredictionPath('primate_ai', 'score'),
        SPLICE_AI_FIELD: PredictionPath(SPLICE_AI_FIELD, 'delta_score'),
        'splice_ai_consequence': PredictionPath(SPLICE_AI_FIELD, 'splice_consequence'),
        'vest': PredictionPath('dbnsfp', 'VEST4_score'),
        'mut_taster': PredictionPath('dbnsfp', 'MutationTaster_pred'),
        'polyphen': PredictionPath('dbnsfp', 'Polyphen2_HVAR_pred'),
        'revel': PredictionPath('dbnsfp', 'REVEL_score'),
        'sift': PredictionPath('dbnsfp', 'SIFT_pred'),
    }
    PATHOGENICITY_FILTERS = {
        CLINVAR_KEY: ('pathogenicity', CLINVAR_PATH_RANGES),
        HGMD_KEY: ('class', HGMD_PATH_RANGES),
    }

    GLOBALS = BaseHailTableQuery.GLOBALS + ['versions']
    CORE_FIELDS = BaseHailTableQuery.CORE_FIELDS + ['rsid']
    BASE_ANNOTATION_FIELDS = {
        'chrom': lambda r: r.locus.contig.replace("^chr", ""),
        'pos': lambda r: r.locus.position,
        'ref': lambda r: r.alleles[0],
        'alt': lambda r: r.alleles[1],
        'mainTranscriptId': lambda r: r.sorted_transcript_consequences.first().transcript_id,
        'selectedMainTranscriptId': lambda r: hl.or_missing(
            r.selected_transcript != r.sorted_transcript_consequences.first(), r.selected_transcript.transcript_id,
        ),
    }
    BASE_ANNOTATION_FIELDS.update(BaseHailTableQuery.BASE_ANNOTATION_FIELDS)
    ENUM_ANNOTATION_FIELDS = {
        'clinvar': {'annotate_value': lambda value, enum, ht_globals: {
            'conflictingPathogenicities': VariantHailTableQuery._format_enum(
                value, 'conflictingPathogenicities', enum, enum_keys=['pathogenicity']),
            'version': ht_globals['versions'].clinvar,
        }},
        'screen': {
            'response_key': 'screenRegionType',
            'format_value': lambda value: value.region_types.first(),
        },
        TRANSCRIPTS_FIELD: {
            **BaseHailTableQuery.ENUM_ANNOTATION_FIELDS['transcripts'],
            'annotate_value': lambda transcript, *args: {'major_consequence': transcript.consequence_terms.first()},
            'drop_fields': ['consequence_terms'],
        }
    }

    SORTS = {
        CONSEQUENCE_SORT: lambda r: [
            hl.min(r.sorted_transcript_consequences.flatmap(lambda t: t.consequence_term_ids)),
            hl.min(r.selected_transcript.consequence_term_ids),
        ],
        PATHOGENICTY_SORT_KEY: lambda r: [hl.or_else(r.clinvar.pathogenicity_id, ABSENT_PATH_SORT_OFFSET)],
    }
    SORTS[PATHOGENICTY_HGMD_SORT_KEY] = lambda r: VariantHailTableQuery.SORTS[PATHOGENICTY_SORT_KEY](r) + [r.hgmd.class_id]
    SORTS.update(BaseHailTableQuery.SORTS)

    @staticmethod
    def _selected_main_transcript_expr(ht):
        gene_id = getattr(ht, 'gene_id', None)
        if gene_id is not None:
            gene_transcripts = ht.sorted_transcript_consequences.filter(lambda t: t.gene_id == ht.gene_id)
        else:
            gene_transcripts = getattr(ht, 'gene_transcripts', None)

        allowed_transcripts = getattr(ht, 'allowed_transcripts', None)
        if hasattr(ht, HAS_ALLOWED_SECONDARY_ANNOTATION):
            allowed_transcripts = hl.if_else(
                allowed_transcripts.any(hl.is_defined), allowed_transcripts, ht.allowed_transcripts_secondary,
            ) if allowed_transcripts is not None else ht.allowed_transcripts_secondary

        main_transcript = ht.sorted_transcript_consequences.first()
        if gene_transcripts is not None and allowed_transcripts is not None:
            allowed_transcript_ids = hl.set(allowed_transcripts.map(lambda t: t.transcript_id))
            matched_transcript = hl.or_else(
                gene_transcripts.find(lambda t: allowed_transcript_ids.contains(t.transcript_id)),
                gene_transcripts.first(),
            )
        elif gene_transcripts is not None:
            matched_transcript = gene_transcripts.first()
        elif allowed_transcripts is not None:
            matched_transcript = allowed_transcripts.first()
        else:
            matched_transcript = main_transcript

        return hl.or_else(matched_transcript, main_transcript)

    def __init__(self, *args, **kwargs):
        self._filter_hts = {}
        super(VariantHailTableQuery, self).__init__(*args, **kwargs)

    def _parse_intervals(self, intervals, variant_ids, exclude_intervals=False, **kwargs):
        parsed_intervals, variant_ids = super()._parse_intervals(intervals, variant_ids, **kwargs)
        if parsed_intervals and not exclude_intervals:
            self._load_table_kwargs = {'_intervals': parsed_intervals, '_filter_intervals': True}
        return parsed_intervals, variant_ids

    def _get_family_passes_quality_filter(self, quality_filter, ht=None, pathogenicity=None, **kwargs):
        passes_quality = super(VariantHailTableQuery, self)._get_family_passes_quality_filter(quality_filter)
        clinvar_path_ht = False if passes_quality is None else self._get_loaded_filter_ht(
            CLINVAR_KEY, 'clinvar_path_variants.ht', self._get_clinvar_prefilter, pathogenicity=pathogenicity)
        if not clinvar_path_ht:
            return passes_quality

        return lambda entries: hl.is_defined(clinvar_path_ht[ht.key]) | passes_quality(entries)

    def _get_loaded_filter_ht(self, key, table_path, get_filters, **kwargs):
        if self._filter_hts.get(key) is None:
            ht_filter = get_filters(**kwargs)
            if ht_filter is False:
                self._filter_hts[key] = False
            else:
                ht = self._read_table(table_path)
                if ht_filter is not True:
                    ht = ht.filter(ht[ht_filter])
                self._filter_hts[key] = ht

        return self._filter_hts[key]

    def _get_clinvar_prefilter(self, pathogenicity=None):
        clinvar_path_filters = self._get_clinvar_path_filters(pathogenicity)
        if not clinvar_path_filters:
            return False

        if CLINVAR_LIKELY_PATH_FILTER not in clinvar_path_filters:
            return 'is_pathogenic'
        elif CLINVAR_PATH_FILTER not in clinvar_path_filters:
            return 'is_likely_pathogenic'
        return True

    def _filter_variant_ids(self, ht, variant_ids):
        if len(variant_ids) == 1:
            variant_id_q = ht.alleles == [variant_ids[0][2], variant_ids[0][3]]
        else:
            variant_id_q = hl.any([
                (ht.locus == hl.locus(chrom, pos, reference_genome=self._genome_version)) &
                (ht.alleles == [ref, alt])
                for chrom, pos, ref, alt in variant_ids
            ])
        return ht.filter(variant_id_q)

    def _prefilter_entries_table(self, ht, parsed_intervals=None, exclude_intervals=False, **kwargs):
        if exclude_intervals and parsed_intervals:
            ht = hl.filter_intervals(ht, parsed_intervals, keep=False)
        af_ht = self._get_loaded_filter_ht(
            GNOMAD_GENOMES_FIELD, 'high_af_variants.ht', self._get_gnomad_af_prefilter, **kwargs)
        if af_ht:
            ht = ht.filter(hl.is_missing(af_ht[ht.key]))
        return ht

    def _get_gnomad_af_prefilter(self, frequencies=None, pathogenicity=None, **kwargs):
        gnomad_genomes_filter = (frequencies or {}).get(GNOMAD_GENOMES_FIELD, {})
        af_cutoff = gnomad_genomes_filter.get('af')
        if af_cutoff is None and gnomad_genomes_filter.get('ac') is not None:
            af_cutoff = PREFILTER_FREQ_CUTOFF
        if af_cutoff is None:
            return False

        if self._get_clinvar_path_filters(pathogenicity):
            af_cutoff = max(af_cutoff, PATH_FREQ_OVERRIDE_CUTOFF)

        return 'is_gt_10_percent' if af_cutoff > PREFILTER_FREQ_CUTOFF else True

    def _get_consequence_filter(self, allowed_consequence_ids, annotation_exprs):
        allowed_transcripts = self._ht.sorted_transcript_consequences.filter(
            lambda tc: tc.consequence_term_ids.any(allowed_consequence_ids.contains)
        )
        annotation_exprs['allowed_transcripts'] = allowed_transcripts
        return hl.is_defined(allowed_transcripts.first())

    def _get_annotation_override_filters(self, annotations, pathogenicity=None, **kwargs):
        annotation_filters = []

        for key in self.PATHOGENICITY_FILTERS.keys():
            path_terms = (pathogenicity or {}).get(key)
            if path_terms:
                annotation_filters.append(self._has_path_expr(path_terms, key))
        if annotations.get(SCREEN_KEY):
            allowed_consequences = hl.set(self._get_enum_terms_ids(SCREEN_KEY.lower(), 'region_type', annotations[SCREEN_KEY]))
            annotation_filters.append(allowed_consequences.contains(self._ht.screen.region_type_ids.first()))
        if annotations.get(SPLICE_AI_FIELD):
            score_filter, _ = self._get_in_silico_filter(SPLICE_AI_FIELD, annotations[SPLICE_AI_FIELD])
            annotation_filters.append(score_filter)

        return annotation_filters

    def _frequency_override_filter(self, pathogenicity):
        path_terms = self._get_clinvar_path_filters(pathogenicity)
        return self._has_path_expr(path_terms, CLINVAR_KEY) if path_terms else None

    @staticmethod
    def _get_clinvar_path_filters(pathogenicity):
        return {
            f for f in (pathogenicity or {}).get(CLINVAR_KEY) or [] if f in CLINVAR_PATH_SIGNIFICANCES
        }

    def _has_path_expr(self, terms, field):
        subfield, range_configs = self.PATHOGENICITY_FILTERS[field]
        enum_lookup = self._get_enum_lookup(field, subfield)

        ranges = [[None, None]]
        for path_filter, start, end in range_configs:
            if path_filter in terms:
                ranges[-1][1] = len(enum_lookup) if end is None else enum_lookup[end]
                if ranges[-1][0] is None:
                    ranges[-1][0] = enum_lookup[start]
            elif ranges[-1] != [None, None]:
                ranges.append([None, None])

        ranges = [r for r in ranges if r[0] is not None]
        value = self._ht[field][f'{subfield}_id']
        return hl.any(lambda r: (value >= r[0]) & (value <= r[1]), ranges)

    def _format_results(self, ht, annotation_fields):
        ht = ht.annotate(selected_transcript=self._selected_main_transcript_expr(ht))
        return super()._format_results(ht, annotation_fields)

    @classmethod
    def _omim_sort(cls, r, omim_gene_set):
        return [
            hl.if_else(omim_gene_set.contains(r.selected_transcript.gene_id), 0, 1),
        ] + super()._omim_sort(r, omim_gene_set)

    @classmethod
    def _gene_rank_sort(cls, r, gene_ranks):
        return [gene_ranks.get(r.selected_transcript.gene_id)] + super()._gene_rank_sort(r, gene_ranks)