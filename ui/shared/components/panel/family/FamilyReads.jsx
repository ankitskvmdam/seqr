import React from 'react'
import ReactDOMServer from 'react-dom/server'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { Segment, Icon } from 'semantic-ui-react'

import {
  getIndividualsByGuid,
  getIGVSamplesByFamilySampleIndividual,
  getFamiliesByGuid,
  getProjectsByGuid,
} from 'redux/selectors'
import PedigreeIcon from '../../icons/PedigreeIcon'
import { CheckboxGroup } from '../../form/Inputs'
import IGV from '../../graph/IGV'
import { ButtonLink } from '../../StyledComponents'
import { VerticalSpacer } from '../../Spacers'
import { getLocus } from '../variants/Annotations'
import { AFFECTED, GENOME_VERSION_DISPLAY_LOOKUP, GENOME_VERSION_LOOKUP } from '../../../utils/constants'

const ALIGNMENT_TYPE = 'alignment'
const COVERAGE_TYPE = 'wig'
const JUNCTION_TYPE = 'spliceJunctions'
const GCNV_TYPE = 'gcnv'


const ALIGNMENT_TRACK_OPTIONS = {
  alignmentShading: 'strand',
  format: 'cram',
  showSoftClips: true,
}

const CRAM_PROXY_TRACK_OPTIONS = {
  sourceType: 'pysam',
  alignmentFile: '/placeholder.cram',
  referenceFile: '/placeholder.fa',
}

const BAM_TRACK_OPTIONS = {
  indexed: true,
  format: 'bam',
}

const COVERAGE_TRACK_OPTIONS = {
  format: 'bigwig',
  height: 170,
}

const JUNCTION_TRACK_OPTIONS = {
  format: 'bed',
  height: 170,
  minUniquelyMappedReads: 0,
  minTotalReads: 1,
  maxFractionMultiMappedReads: 1,
  minSplicedAlignmentOverhang: 0,
  colorBy: 'isAnnotatedJunction',
  labelUniqueReadCount: true,
}

const GCNV_TRACK_OPTIONS = {
  format: 'gcnv',
  height: 200,
  min: 0,
  max: 5,
  autoscale: true,
  onlyHandleClicksForHighlightedSamples: true,
}

const TRACK_OPTIONS = {
  [ALIGNMENT_TYPE]: ALIGNMENT_TRACK_OPTIONS,
  [COVERAGE_TYPE]: COVERAGE_TRACK_OPTIONS,
  [JUNCTION_TYPE]: JUNCTION_TRACK_OPTIONS,
  [GCNV_TYPE]: GCNV_TRACK_OPTIONS,
}

const BUTTON_PROPS = {
  [ALIGNMENT_TYPE]: { icon: 'options', content: 'SHOW READS' },
  [JUNCTION_TYPE]: { icon: { name: 'dna', rotated: 'clockwise' }, content: 'SHOW RNASeq' },
  [GCNV_TYPE]: { icon: 'industry', content: 'SHOW gCNV' },
}

const DNA_TRACK_TYPE_OPTIONS = [
  { value: ALIGNMENT_TYPE, text: 'Alignment', description: 'BAMs/CRAMs' },
  { value: GCNV_TYPE, text: 'gCNV' },
]

const RNA_TRACK_TYPE_OPTIONS = [
  { value: JUNCTION_TYPE, text: 'Splice Junctions' },
  { value: COVERAGE_TYPE, text: 'Coverage', description: 'RNASeq coverage' },
]

const IGV_OPTIONS = {
  loadDefaultGenomes: false,
  showKaryo: false,
  showIdeogram: true,
  showNavigation: true,
  showRuler: true,
  showCenterGuide: true,
  showCursorTrackingGuide: true,
  showCommandBar: true,
}

const BASE_REFERENCE_URL = '/api/igv_genomes'

const REFERENCE_URLS = [
  {
    key: 'fastaURL',
    baseUrl: `${BASE_REFERENCE_URL}/broadinstitute.org/genomes/seq`,
    path: {
      37: 'hg19/hg19.fasta',
      38: 'hg38/hg38.fa',
    },
  },
  {
    key: 'cytobandURL',
    baseUrl: BASE_REFERENCE_URL,
    path: {
      37: 'broadinstitute.org/genomes/seq/hg19/cytoBand.txt',
      38: 'org.genomes/hg38/annotations/cytoBandIdeo.txt.gz',
    },
  },
  {
    key: 'aliasURL',
    baseUrl: `${BASE_REFERENCE_URL}/org.genomes`,
    path: {
      37: 'hg19/hg19_alias.tab',
      38: 'hg38/hg38_alias.tab',
    },
  },
]

const REFERENCE_TRACKS = [
  {
    name: 'Gencode v32',
    indexPostfix: 'tbi',
    baseUrl: 'https://storage.googleapis.com/seqr-reference-data',
    path: {
      37: 'GRCh37/gencode/gencode.v32lift37.annotation.sorted.bed.gz',
      38: 'GRCh38/gencode/gencode_v32_knownGene.sorted.txt.gz',
    },
    format: 'refgene',
    order: 1000,
  },
  {
    name: 'Refseq',
    indexPostfix: 'tbi',
    baseUrl: `${BASE_REFERENCE_URL}/org.genomes`,
    path: {
      37: 'hg19/refGene.sorted.txt.gz',
      38: 'hg38/refGene.sorted.txt.gz',
    },
    format: 'refgene',
    visibilityWindow: -1,
    order: 1001,
  },
]

const GTEX_TRACKS = [
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_muscle.803_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_muscle.803_samples.junctions.bed.gz',
      }],
    description: 'All splice junctions from all 803 GTEx v3 muscle samples. The junction-spanning read counts and read coverage are summed across all samples.',
    text: 'GTEx Muscle',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_blood.755_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_blood.755_samples.junctions.bed.gz',
      }],
    description: 'All splice junctions from all 755 GTEx v3 blood samples. The junction-spanning read counts and read coverage are summed across all samples.',
    text: 'GTEx Blood',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_fibs.504_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_fibs.504_samples.junctions.bed.gz',
      },
    ],
    description: 'All splice junctions from all 504 GTEx v3 fibroblast samples. The junction-spanning read counts and read coverage are summed across all samples.',
    text: 'GTEx Fibs',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_lymphocytes.174_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_lymphocytes.174_samples.junctions.bed.gz',
      },
    ],
    description: 'All splice junctions from all 174 GTEx v3 lymphocyte samples. The junction-spanning read counts and read coverage are summed across all samples.',
    text: 'GTEx Lymph',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_brain_cortex.255_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_brain_cortex.255_samples.junctions.bed.gz',
      },
    ],
    description: 'All splice junctions from all 255 GTEx v3 cortex samples. The junction-spanning read counts and read coverage are summed across all samples.',
    text: 'GTEx Brain: Cortex',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_frontal_cortex.209_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_frontal_cortex.209_samples.junctions.bed.gz',
      },
    ],
    description: 'All splice junctions from all 209 GTEx v3 frontal cortex samples. The junction-spanning read counts and read coverage are summed across all samples.',
    text: 'GTEx Brain: Front. Cortex',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_muscle.803_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_muscle.803_samples.normalized.junctions.bed.gz',
      },
    ],
    description: 'Highly expressed junctions from all 803 GTEx v3 muscle samples. The junction-spanning read counts are normalized to represent the average spanning read count per-sample (see formula below). Only junctions with rounded normalized spanning read count > 0 are included in this track.\n\n  average_unique_reads_per_muscle_sample = (total_unqiue_reads_in_all_muscle_samples / number_of_muscle_samples)\n per_sample_normalized_read_count = raw_read_count * average_unique_reads_per_muscle_sample / total_unqiue_reads_in_this_sample\n normalized read count for junction = sum(per_sample_normalized_read_counts) / number_of_muscle_samples',
    text: 'Norm. GTEx Muscle',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_blood.755_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_blood.755_samples.normalized.junctions.bed.gz',
      },
    ],
    description: 'Highly expressed junctions from all 755 GTEx v3 blood samples.\n The junction-spanning read counts are normalized to represent the average spanning read count per-sample (see formula below). Only junctions with rounded normalized spanning read count > 0 are included in this track.\n \n average_unique_reads_per_blood_sample = (total_unqiue_reads_in_all_blood_samples / number_of_blood_samples)\n per_sample_normalized_read_count = raw_read_count * average_unique_reads_per_blood_sample / total_unqiue_reads_in_this_sample\n normalized read count for junction = sum(per_sample_normalized_read_counts) / number_of_blood_samples',
    text: 'Norm. GTEx Blood',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_fibs.504_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_fibs.504_samples.normalized.junctions.bed.gz',
      },
    ],
    description: 'Highly expressed junctions from all 504 GTEx v3 fibroblast samples.\n The junction-spanning read counts are normalized to represent the average spanning read count per-sample (see formula below). Only junctions with rounded normalized spanning read count > 0 are included in this track.\n \n average_unique_reads_per_fibs_sample = (total_unqiue_reads_in_all_fibs_samples / number_of_fibs_samples)\n per_sample_normalized_read_count = raw_read_count * average_unique_reads_per_fibs_sample / total_unqiue_reads_in_this_sample\n normalized read count for junction = sum(per_sample_normalized_read_counts) / number_of_fibs_samples',
    text: 'Norm. GTEx Fibs',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_lymphocytes.174_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_lymphocytes.174_samples.normalized.junctions.bed.gz',
      },
    ],
    description: 'Highly expressed junctions from all 174 GTEx v3 lymphocyte samples.\n The junction-spanning read counts are normalized to represent the average spanning read count per-sample (see formula below). Only junctions with rounded normalized spanning read count > 0 are included in this track.\n \n average_unique_reads_per_lymph_sample = (total_unqiue_reads_in_all_lymph_samples / number_of_lymph_samples)\n per_sample_normalized_read_count = raw_read_count * average_unique_reads_per_lymph_sample / total_unqiue_reads_in_this_sample\n normalized read count for junction = sum(per_sample_normalized_read_counts) / number_of_lymph_samples',
    text: 'Norm. GTEx Lymph',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_brain_cortex.255_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_brain_cortex.255_samples.normalized.junctions.bed.gz',
      },
    ],
    description: 'Highly expressed junctions from all 255 GTEx v3 brain cortex samples.\n The junction-spanning read counts are normalized to represent the average spanning read count per-sample (see formula below).\n Only junctions with rounded normalized spanning read count > 0 are included in this track.\n \n average_unique_reads_per_cortex_sample = (total_unqiue_reads_in_all_cortex_samples / number_of_cortex_samples)\n per_sample_normalized_read_count = raw_read_count * average_unique_reads_per_cortex_sample / total_unqiue_reads_in_this_sample\n normalized read count for junction = sum(per_sample_normalized_read_counts) / number_of_cortex_samples',
    text: 'Norm. GTEx Brain: Cortex',
  },
  {
    data: [
      {
        type: 'coverage',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_frontal_cortex.209_samples.bigWig',
      },
      {
        type: 'junctions',
        url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/gtex_v8/GTEX_frontal_cortex.209_samples.normalized.junctions.bed.gz',
      },
    ],
    description: 'Highly expressed junctions from all 209 GTEx v3 brain frontal cortex samples.\n The junction-spanning read counts are normalized to represent the average spanning read count per-sample (see formula below).\n Only junctions with rounded normalized spanning read count > 0 are included in this track.\n \n average_unique_reads_per_cortex_sample = (total_unqiue_reads_in_all_cortex_samples / number_of_cortex_samples)\n per_sample_normalized_read_count = raw_read_count * average_unique_reads_per_cortex_sample / total_unqiue_reads_in_this_sample\n normalized read count for junction = sum(per_sample_normalized_read_counts) / number_of_cortex_samples',
    text: 'Norm. GTEx Brain: Front. Cortex',
  },
]

const getRefTrackOptions = tracks => tracks.map(({ text, description }) => ({ value: text, text, description }))

const GTEX_TRACK_OPTIONS = getRefTrackOptions(GTEX_TRACKS)

const MAPPABILITY_TRACKS = [
  {
    data: [{
      type: 'coverage',
      url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/mappability/GRCh38_no_alt_analysis_set_GCA_000001405.15-k36_m2.bw',
    }],
    text: '36-mer mappability',
    description: 'Mappability of 36-mers allowing for 2 mismatches. Generated using the same pipeline as the UCSC hg19 mappability tracks.',
  },
  {
    data: [{
      type: 'coverage',
      url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/mappability/GRCh38_no_alt_analysis_set_GCA_000001405.15-k50_m2.bw',
    }],
    text: '50-mer mappability',
    description: 'Mappability of 50-mers allowing for 2 mismatches. Generated using the same pipeline as the UCSC hg19 mappability tracks.',
  },
  {
    data: [{
      type: 'coverage',
      url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/mappability/GRCh38_no_alt_analysis_set_GCA_000001405.15-k75_m2.bw',
    }],
    text: '75-mer mappability',
    description: 'Mappability of 75-mers allowing for 2 mismatches. Generated using the same pipeline as the UCSC hg19 mappability tracks.',
  },
  {
    data: [{
      type: 'coverage',
      url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/mappability/GRCh38_no_alt_analysis_set_GCA_000001405.15-k100_m2.bw',
    }],
    text: '100-mer mappability',
    description: 'Mappability of 100-mers allowing for 2 mismatches. Generated using the same pipeline as the UCSC hg19 mappability tracks.',
  },
  {
    data: [{
      type: 'gtf',
      url: 'https://storage.googleapis.com/tgg-viewer/ref/GRCh38/segdups/segdups.gtf.gz',
    }],
    text: 'SegDups >1000 bases',
    description: 'Duplications of >1000 Bases of Non-RepeatMasked Sequence downloaded from UCSC',
  },
]

const MAPPABILITY_TRACK_OPTIONS = getRefTrackOptions(MAPPABILITY_TRACKS)

const parseTrackType = (type, url) => {
  const track = { url }
  if (type === 'coverage') {
    track.type = 'wig'
    track.format = 'bigWig'
  } else if (type === 'junctions') {
    track.type = 'spliceJunctions'
    track.format = 'bed'
  } else if (type === 'gtf') {
    track.type = 'annotation'
    track.format = 'gtf'
  }
  if (url.endsWith('.gz') || url.endsWith('.bgz')) {
    track.indexURL = `${url}.tbi`
  }
  return track
}

const getRefTracks = (tracks, sampleTypes) => tracks.reduce((acc, { text, data }) => (sampleTypes.includes(text) ? [
  ...acc,
  data.length === 1 ? { name: text, ...parseTrackType(data[0].type, data[0].url) } : {
    name: text,
    type: 'merged',
    tracks: data.map(track => (parseTrackType(track.type, track.url))),
  },
] : acc), [])

const REFERENCE_LOOKUP = ['37', '38'].reduce((acc, genome) => ({
  ...acc,
  [genome]: {
    id: GENOME_VERSION_DISPLAY_LOOKUP[GENOME_VERSION_LOOKUP[genome]],
    tracks: REFERENCE_TRACKS.map(({ baseUrl, path, indexPostfix, ...track }) => ({
      url: `${baseUrl}/${path[genome]}`,
      indexURL: indexPostfix ? `${baseUrl}/${path[genome]}.${indexPostfix}` : null,
      ...track })),
    ...REFERENCE_URLS.reduce((acc2, { key, baseUrl, path }) => ({ ...acc2, [key]: `${baseUrl}/${path[genome]}` }), {}),
  },
}), {})


const getTrackOptions = (type, sample, individual) => {
  const name = ReactDOMServer.renderToString(
    <span id={`${individual.displayName}-${type}`}>
      <PedigreeIcon sex={individual.sex} affected={individual.affected} />{individual.displayName}
    </span>,
  )

  const url = `/api/project/${sample.projectGuid}/igv_track/${encodeURIComponent(sample.filePath)}`

  return { url, name, type, ...TRACK_OPTIONS[type] }
}

const getIgvTracks = (igvSampleIndividuals, individualsByGuid, sampleTypes) => {
  const gcnvSamplesByBatch = Object.entries(igvSampleIndividuals[GCNV_TYPE] || {}).reduce(
    (acc, [individualGuid, { filePath, sampleId }]) => {
      if (!acc[filePath]) {
        acc[filePath] = {}
      }
      acc[filePath][individualGuid] = sampleId
      return acc
    }, {})

  const getIndivSampleType = (type, individualGuid) =>
    sampleTypes.includes(type) && (igvSampleIndividuals[type] || {})[individualGuid]

  return Object.entries(igvSampleIndividuals).reduce((acc, [type, samplesByIndividual]) => (
    sampleTypes.includes(type) ? [
      ...acc,
      ...Object.entries(samplesByIndividual).map(([individualGuid, sample]) => {
        const individual = individualsByGuid[individualGuid]
        const track = getTrackOptions(type, sample, individual)

        if (type === ALIGNMENT_TYPE) {
          if (sample.filePath.endsWith('.cram')) {
            if (sample.filePath.startsWith('gs://')) {
              Object.assign(track, {
                format: 'cram',
                indexURL: `${track.url}.crai`,
              })
            } else {
              Object.assign(track, CRAM_PROXY_TRACK_OPTIONS)
            }
          } else {
            Object.assign(track, BAM_TRACK_OPTIONS)
          }
        } else if (type === JUNCTION_TYPE) {
          track.indexURL = `${track.url}.tbi`

          const coverageSample = getIndivSampleType(COVERAGE_TYPE, individualGuid)
          if (coverageSample) {
            const coverageTrack = getTrackOptions(COVERAGE_TYPE, coverageSample, individual)
            return {
              type: 'merged',
              name: track.name,
              height: track.height,
              tracks: [coverageTrack, track],
            }
          }
        } else if (type === COVERAGE_TYPE && getIndivSampleType(JUNCTION_TYPE, individualGuid)) {
          return null
        } else if (type === GCNV_TYPE) {
          const batch = gcnvSamplesByBatch[sample.filePath]
          const individualGuids = Object.keys(batch).sort()

          return individualGuids[0] === individualGuid ? {
            ...track,
            indexURL: `${track.url}.tbi`,
            highlightSamples: Object.entries(batch).reduce((higlightAcc, [iGuid, sampleId]) => ({
              [sampleId || individualsByGuid[iGuid].individualId]:
                individualsByGuid[iGuid].affected === AFFECTED ? 'red' : 'blue',
              ...higlightAcc,
            }), {}),
            name: individualGuids.length === 1 ? track.name : individualGuids.map(
              iGuid => individualsByGuid[iGuid].displayName).join(', '),
          } : null
        }

        return track
      }),
    ] : acc
  ), []).filter(track => track)
}

const ShowIgvButton = ({ type, showReads, ...props }) => (BUTTON_PROPS[type] ?
  <ButtonLink
    padding="0 0 0 1em"
    onClick={showReads && showReads(type === JUNCTION_TYPE ? [JUNCTION_TYPE, COVERAGE_TYPE] : [type])}
    {...BUTTON_PROPS[type]}
    {...props}
  /> : null
)

ShowIgvButton.propTypes = {
  type: PropTypes.string,
  familyGuid: PropTypes.string,
  showReads: PropTypes.func,
}

const ReadButtons = React.memo(({ variant, familyGuid, igvSamplesByFamilySampleIndividual, familiesByGuid, buttonProps, showReads }) => {
  const familyGuids = variant ? variant.familyGuids : [familyGuid]

  const sampleTypeFamilies = familyGuids.reduce(
    (acc, fGuid) => {
      Object.keys((igvSamplesByFamilySampleIndividual || {})[fGuid] || {}).forEach((type) => {
        if (!acc[type]) {
          acc[type] = []
        }
        acc[type].push(fGuid)
      })
      return acc
    }, {})

  if (!Object.keys(sampleTypeFamilies).length) {
    return null
  }

  if (familyGuids.length === 1) {
    return Object.keys(sampleTypeFamilies).map(type =>
      <ShowIgvButton key={type} type={type} {...buttonProps} showReads={showReads(familyGuids[0])} />,
    )
  }

  return Object.entries(sampleTypeFamilies).reduce((acc, [type, fGuids]) => ([
    ...acc,
    <ShowIgvButton key={type} type={type} {...buttonProps} />,
    ...fGuids.map(fGuid =>
      <ShowIgvButton
        key={`${fGuid}-${type}`}
        content={`| ${familiesByGuid[fGuid].familyId}`}
        icon={null}
        type={type}
        showReads={showReads(fGuid)}
        padding="0"
      />,
    ),
  ]), [])

})

ReadButtons.propTypes = {
  variant: PropTypes.object,
  familyGuid: PropTypes.string,
  buttonProps: PropTypes.object,
  familiesByGuid: PropTypes.object,
  igvSamplesByFamilySampleIndividual: PropTypes.object,
  showReads: PropTypes.func,
}


const IgvPanel = React.memo(({ variant, igvSampleIndividuals, individualsByGuid, project, sampleTypes, gtexRefs, mappabilityRefs }) => {
  const locus = variant && getLocus(
    variant.chrom,
    (variant.genomeVersion !== project.genomeVersion && variant.liftedOverPos) ? variant.liftedOverPos : variant.pos,
    100,
  )

  const tracks = getIgvTracks(igvSampleIndividuals, individualsByGuid, sampleTypes)
  const refTracks = getRefTracks(MAPPABILITY_TRACKS, mappabilityRefs).concat(getRefTracks(GTEX_TRACKS, gtexRefs))

  return (
    <IGV tracks={tracks.concat(refTracks)} reference={REFERENCE_LOOKUP[project.genomeVersion]} locus={locus} {...IGV_OPTIONS} />
  )
})

IgvPanel.propTypes = {
  variant: PropTypes.object,
  sampleTypes: PropTypes.array,
  gtexRefs: PropTypes.array,
  mappabilityRefs: PropTypes.array,
  individualsByGuid: PropTypes.object,
  igvSampleIndividuals: PropTypes.object,
  project: PropTypes.object,
}


class FamilyReads extends React.PureComponent {

  static propTypes = {
    variant: PropTypes.object,
    layout: PropTypes.any,
    familyGuid: PropTypes.string,
    buttonProps: PropTypes.object,
    projectsByGuid: PropTypes.object,
    familiesByGuid: PropTypes.object,
    individualsByGuid: PropTypes.object,
    igvSamplesByFamilySampleIndividual: PropTypes.object,
  }

  constructor(props) {
    super(props)
    this.state = {
      openFamily: null,
      dnaSampleTypes: [],
      rnaSampleTypes: [],
      gtexReferences: [],
      mappabilityRefs: [],
    }
  }

  showReads = familyGuid => sampleTypes => () => {
    const isDnaType = DNA_TRACK_TYPE_OPTIONS.reduce((acc, { value }) => acc || sampleTypes.includes(value), false)
    if (isDnaType) {
      this.setState({
        openFamily: familyGuid,
        dnaSampleTypes: sampleTypes,
      })
    } else {
      this.setState({
        openFamily: familyGuid,
        rnaSampleTypes: sampleTypes,
      })
    }
  }

  hideReads = () => {
    this.setState({
      openFamily: null,
      dnaSampleTypes: [],
      rnaSampleTypes: [],
      gtexReferences: [],
      mappabilityRefs: [],
    })
  }

  updateSampleTypes = (key, sampleTypes) => {
    this.setState({
      [key]: sampleTypes,
    })
  }

  render() {
    const {
      variant, familyGuid, buttonProps, layout, igvSamplesByFamilySampleIndividual, individualsByGuid, familiesByGuid,
      projectsByGuid, ...props
    } = this.props

    const showReads = <ReadButtons
      variant={variant}
      familyGuid={familyGuid}
      buttonProps={buttonProps}
      igvSamplesByFamilySampleIndividual={igvSamplesByFamilySampleIndividual}
      familiesByGuid={familiesByGuid}
      showReads={this.showReads}
    />

    const igvSampleIndividuals = this.state.openFamily && (igvSamplesByFamilySampleIndividual || {})[this.state.openFamily]
    const trackOptions = trackTypeOptions => trackTypeOptions.filter(({ value }) => igvSampleIndividuals && igvSampleIndividuals[value])
    const dnaTrackOptions = trackOptions(DNA_TRACK_TYPE_OPTIONS)
    const rnaTrackOptions = trackOptions(RNA_TRACK_TYPE_OPTIONS)
    const reads = igvSampleIndividuals ?
      <Segment.Group horizontal>
        <Segment>
          { dnaTrackOptions &&
            <CheckboxGroup
              groupLabel="DNA Tracks"
              value={this.state.dnaSampleTypes}
              options={dnaTrackOptions}
              onChange={sampleTypes => this.updateSampleTypes('dnaSampleTypes', sampleTypes)}
            />
          }
          { rnaTrackOptions &&
            <div>
              <CheckboxGroup
                groupLabel="RNA Tracks"
                value={this.state.rnaSampleTypes}
                options={rnaTrackOptions}
                onChange={sampleTypes => this.updateSampleTypes('rnaSampleTypes', sampleTypes)}
              />
              <b>Reference Tracks</b>
              <CheckboxGroup
                groupLabel="GTEx Tracks"
                value={this.state.gtexReferences}
                options={GTEX_TRACK_OPTIONS}
                onChange={sampleTypes => this.updateSampleTypes('gtexReferences', sampleTypes)}
              />
              <CheckboxGroup
                groupLabel="Mappability Tracks"
                value={this.state.mappabilityRefs}
                options={MAPPABILITY_TRACK_OPTIONS}
                onChange={sampleTypes => this.updateSampleTypes('mappabilityRefs', sampleTypes)}
              />
            </div>
          }
        </Segment>
        <Segment>
          <ButtonLink onClick={this.hideReads} icon={<Icon name="remove" color="grey" />} floated="right" size="large" />
          <VerticalSpacer height={20} />
          <IgvPanel
            variant={variant}
            igvSampleIndividuals={igvSampleIndividuals}
            sampleTypes={this.state.dnaSampleTypes.concat(this.state.rnaSampleTypes)}
            gtexRefs={this.state.gtexReferences}
            mappabilityRefs={this.state.mappabilityRefs}
            individualsByGuid={individualsByGuid}
            project={projectsByGuid[familiesByGuid[this.state.openFamily].projectGuid]}
          />
        </Segment>
      </Segment.Group> : null

    return React.createElement(layout, { variant, reads, showReads, ...props })
  }
}

const mapStateToProps = state => ({
  igvSamplesByFamilySampleIndividual: getIGVSamplesByFamilySampleIndividual(state),
  individualsByGuid: getIndividualsByGuid(state),
  familiesByGuid: getFamiliesByGuid(state),
  projectsByGuid: getProjectsByGuid(state),
})

export default connect(mapStateToProps)(FamilyReads)
