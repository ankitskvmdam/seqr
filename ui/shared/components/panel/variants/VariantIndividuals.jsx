import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { connect } from 'react-redux'
import { Popup, Icon } from 'semantic-ui-react'

import { getSortedIndividualsByFamily } from 'redux/selectors'
import PedigreeIcon from '../../icons/PedigreeIcon'
import { HorizontalSpacer, VerticalSpacer } from '../../Spacers'
import HpoPanel from '../HpoPanel'


const IndividualsContainer = styled.div`
  display: inline-block;
  padding: 0 10px;
  border-left: 1px solid grey;
  border-right: .5px solid grey;
  margin-left: -1px;
  margin-bottom: 5px;
  border-left: none;
  
  &:first-child {
    padding-left 0;
    margin-left: 0;
    border-left: none;
  }
  
  &:last-child {
    border-right: none;
  }
  
`

const IndividualCell = styled.div`
  display: inline-block;
  vertical-align: top;
  text-align: center;
  padding-right: 20px;
  max-width: ${props => 100 / Math.min(props.numIndividuals, 4)}%;
  overflow: hidden;
  text-overflow: ellipsis;
  
  small {
    text-overflow: ellipsis;
  }
  
  .ui.header {
    padding-top: 3px;
  }
`

const AlleleContainer = styled.span`
  color: black;
  font-size: 1.2em;
`

const PAR_REGIONS = {
  37: {
    X: [[60001, 2699521], [154931044, 155260561]],
    Y: [[10001, 2649521], [59034050, 59363567]],
  },
  38: {
    X: [[10001, 2781480], [155701383, 156030896]],
    Y: [[10001, 2781480], [56887903, 57217416]],
  },
}

const isHemiXVariant = (variant, individual) =>
  individual.sex === 'M' && (variant.chrom === 'X' || variant.chrom === 'Y') &&
  PAR_REGIONS[variant.genomeVersion][variant.chrom].every(region => variant.pos < region[0] || variant.pos > region[1])

const missingParentVariant = variant => (parentGuid) => {
  const parentGenotype = variant.genotypes[parentGuid] || {}
  return parentGenotype.numAlt === 0 && parentGenotype.affected !== 'A'
}

const isHemiUPDVariant = (numAlt, variant, individual) =>
  numAlt === 2 && [individual.maternalGuid, individual.paternalGuid].some(missingParentVariant(variant))

const Allele = React.memo(({ isAlt, variant }) => {
  const allele = isAlt ? variant.alt : variant.ref
  let alleleText = allele.substring(0, 3)
  if (allele.length > 3) {
    alleleText += '...'
  }

  return isAlt ? <b><i>{alleleText}</i></b> : alleleText
})

Allele.propTypes = {
  isAlt: PropTypes.bool,
  variant: PropTypes.object,
}

const SnpAlleles = ({ numAlt, variant, isHemiX }) =>
  <span>
    <Allele isAlt={numAlt > (isHemiX ? 0 : 1)} variant={variant} />/{isHemiX ? '-' : <Allele isAlt={numAlt > 0} variant={variant} />}
  </span>


SnpAlleles.propTypes = {
  numAlt: PropTypes.number,
  isHemiX: PropTypes.bool,
  variant: PropTypes.object,
}

export const Alleles = React.memo(({ numAlt, cn, variant, isHemiX, warning }) =>
  <AlleleContainer>
    {warning &&
      <Popup
        flowing
        trigger={<Icon name="warning sign" color="yellow" />}
        content={<div><b>Warning:</b> {warning}</div>}
      />
    }
    {numAlt >= 0 ?
      <SnpAlleles numAlt={numAlt} variant={variant} isHemiX={isHemiX} /> :
      <span>CN: {cn === (isHemiX ? 1 : 2) ? cn : <b><i>{cn}</i></b>}</span>
    }
  </AlleleContainer>,
)

Alleles.propTypes = {
  numAlt: PropTypes.number,
  cn: PropTypes.number,
  variant: PropTypes.object,
  warning: PropTypes.string,
  isHemiX: PropTypes.bool,
}

const GENOTYPE_DETAILS = [
  { title: 'Genotype', field: 'numAlt' },
  { title: 'Sample Type', field: 'sampleType' },
  {
    title: 'Raw Alt. Alleles',
    variantField: 'originalAltAlleles',
    format: val => (val || []).join(', '),
    shouldHide: (val, variant) => (val || []).length < 1 || ((val || []).length === 1 && val[0] === variant.alt),
  },
  { title: 'Allelic Depth', field: 'ad' },
  { title: 'Read Depth', field: 'dp' },
  { title: 'Genotype Quality', field: 'gq' },
  { title: 'Allelic Balance', field: 'ab', format: val => val && val.toPrecision(2) },
  { title: 'Filter', variantField: 'genotypeFilters', shouldHide: val => (val || []).length < 1 },
  { title: 'Phred Likelihoods', field: 'pl' },
  { title: 'Quality Score', field: 'qs' },
  { title: 'Start', field: 'start' },
  { title: 'End', field: 'end' },
]

const genotypeDetails = (genotype, variant, includeGenotype, isHemiX) =>
  GENOTYPE_DETAILS.map(({ shouldHide, title, field, variantField, format }) => {
    const value = field ? genotype[field] : variant[variantField]

    if (field === 'numAlt') {
      if (includeGenotype) {
        return <span>{title}: <SnpAlleles numAlt={value} variant={variant} isHemiX={isHemiX} /></span>
      }
      return null
    }

    return value && !(shouldHide && shouldHide(value, variant)) ?
      <div key={title}>
        {title}:<HorizontalSpacer width={10} /><b>{format ? format(value) : value}</b>
      </div> : null
  })

const Genotype = React.memo(({ variant, individual, isCompoundHet }) => {
  if (!variant.genotypes) {
    return null
  }
  const genotype = variant.genotypes[individual.individualGuid]
  if (!genotype) {
    return null
  }

  const isHemiX = isHemiXVariant(variant, individual)

  let warning
  if (genotype.defragged) {
    warning = 'Defragged'
  } else if (!isHemiX && isHemiUPDVariant(genotype.numAlt, variant, individual)) {
    warning = 'Potential UPD/ Hemizygosity'
  } else if (isCompoundHet && [individual.maternalGuid, individual.paternalGuid].every(missingParentVariant(variant))) {
    warning = 'Variant absent in parents'
  }

  const hasConflictingNumAlt = genotype.otherSample && genotype.otherSample.numAlt !== genotype.numAlt

  return (
    (genotype.numAlt >= 0 || (variant.svType && genotype.cn >= 0)) ?
      <Popup
        position="top center"
        flowing
        trigger={
          <span>
            {genotype.otherSample && <Popup
              flowing
              header="Additional Sample Type"
              trigger={<Icon name="plus circle" color={hasConflictingNumAlt ? 'red' : 'green'} />}
              content={genotypeDetails(genotype.otherSample, variant, hasConflictingNumAlt, isHemiX)}
            />}
            <Alleles cn={genotype.cn} numAlt={genotype.numAlt} variant={variant} isHemiX={isHemiX} warning={warning} />
            <VerticalSpacer width={5} />
            {genotype.gq || genotype.qs || '-'}{genotype.numAlt >= 0 && `, ${genotype.ab ? genotype.ab.toPrecision(2) : '-'}`}
            {variant.genotypeFilters && <small><br />{variant.genotypeFilters}</small>}
          </span>
        }
        content={genotypeDetails(genotype, variant)}
      />
      : <b>NO CALL</b>
  )
})

Genotype.propTypes = {
  variant: PropTypes.object,
  individual: PropTypes.object,
  isCompoundHet: PropTypes.bool,
}


const BaseVariantIndividuals = React.memo(({ variant, individuals, isCompoundHet }) => (
  <IndividualsContainer>
    {(individuals || []).map(individual =>
      <IndividualCell key={individual.individualGuid} numIndividuals={individuals.length}>
        <PedigreeIcon
          sex={individual.sex}
          affected={individual.affected}
          label={<small>{individual.displayName}</small>}
          popupHeader={individual.displayName}
          popupContent={
            individual.features ? <HpoPanel individual={individual} /> : null
          }
        />
        <br />
        <Genotype variant={variant} individual={individual} isCompoundHet={isCompoundHet} />
      </IndividualCell>,
    )}
  </IndividualsContainer>
))

BaseVariantIndividuals.propTypes = {
  variant: PropTypes.object,
  individuals: PropTypes.array,
  isCompoundHet: PropTypes.bool,
}

const mapStateToProps = (state, ownProps) => ({
  individuals: getSortedIndividualsByFamily(state)[ownProps.familyGuid],
})

const FamilyVariantIndividuals = connect(mapStateToProps)(BaseVariantIndividuals)

const VariantIndividuals = React.memo(({ variant, isCompoundHet }) =>
  <span>
    {variant.familyGuids.map(familyGuid =>
      <FamilyVariantIndividuals key={familyGuid} familyGuid={familyGuid} variant={variant} isCompoundHet={isCompoundHet} />,
    )}
  </span>,
)


VariantIndividuals.propTypes = {
  variant: PropTypes.object,
  isCompoundHet: PropTypes.bool,
}

export default VariantIndividuals
